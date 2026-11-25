import { useEffect, useState } from 'react'
import {
  deleteGame,
  deleteMediaFiles,
  deleteMediaIfUnused,
  findUnusedMedia,
  listGames,
  mediaBytes,
  protectStorage,
  saveGame,
  storageUsed,
} from '../db'
import { allMediaIds, copyGame } from '../game'
import { exportedAt, exportFileName, exportGame, importGame, markExported } from '../gameFile'
import { clearRehearsal, clearState, hasSavedState } from '../live'
import type { Game } from '../types'

const BIG_ZIP = 500 * 1024 * 1024 // файл игры больше — предупреждаем: собирается и открывается целиком в памяти

// Стартовый экран «Мои игры»: создать игру, открыть файл, список своих игр.
export default function LibraryApp() {
  const [games, setGames] = useState<Game[] | null>(null)

  function reload() {
    listGames().then(setGames) // испорченные игры listGames чинит сам
  }

  useEffect(reload, [])

  // Сохранность: просим браузер не стирать игры и показываем, сколько места они занимают
  const [safe, setSafe] = useState<boolean | null>(null)
  const [used, setUsed] = useState<number | null>(null)
  useEffect(() => {
    void protectStorage().then(setSafe)
  }, [])
  // Ненужные файлы (ни в одной игре и ни в черновике) — можно убрать одной кнопкой
  const [unused, setUnused] = useState<{ ids: string[]; bytes: number } | null>(null)
  useEffect(() => {
    void storageUsed().then(setUsed)
    void findUnusedMedia().then(setUnused)
  }, [games])

  async function removeUnused() {
    if (!unused?.ids.length) return
    const text = `Убрать ${unused.ids.length} файл(ов), ${formatSize(unused.bytes)}? Они не используются ни в одной игре и ни в черновике «Быстрой игры».`
    if (!window.confirm(text)) return
    await deleteMediaFiles(unused.ids)
    setMessage({ text: `Убрано: ${formatSize(unused.bytes)}.` })
    reload()
  }
  const [exported, setExported] = useState(exportedAt) // когда какую игру сохраняли файлом

  async function remove(game: Game) {
    if (!window.confirm(`Удалить игру «${game.title}»? Это нельзя отменить.`)) return
    await deleteGame(game.id)
    clearState(game.id) // и сохранённую партию этой игры
    clearRehearsal(game.id)
    // Файлы этой игры больше не нужны, если их не использует другая игра (например, её копия)
    for (const id of allMediaIds(game)) await deleteMediaIfUnused(id)
    reload()
  }

  // Копия игры: удобно начать новую игру с готовой и поменять вопросы
  async function duplicate(game: Game) {
    await saveGame(copyGame(game))
    reload()
  }

  const [busy, setBusy] = useState<string | null>(null) // что сейчас делается: «Открываю…», «Собираю файл…»
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  // Открыть файл игры (.zip): игра со всеми картинками и музыкой появится в списке
  async function openFile(file: File | undefined) {
    if (!file) return
    setMessage(null)
    // Файл открывается целиком в памяти: большой — открываем всё равно, но предупреждаем, что это долго
    const big = file.size > BIG_ZIP
    setBusy(`Открываю «${file.name}» (${formatSize(file.size)})…${big ? ' Файл большой — это может занять несколько минут.' : ''}`)
    try {
      const game = await importGame(file)
      setMessage({ text: `Игра «${game.title}» добавлена.` })
      reload()
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Не получилось открыть файл.'
      setMessage({ text: big ? `${text} Файл очень большой — попробуйте на компьютере помощнее или закройте другие вкладки.` : text, error: true })
    } finally {
      setBusy(null)
    }
  }

  // Отправить файлом: скачать .zip со всей игрой, чтобы открыть его на другом ноутбуке
  async function sendFile(game: Game) {
    setMessage(null)
    // Файл собирается целиком в памяти. Сохранение не останавливаем — только предупреждаем, что большой файл соберётся не сразу
    const size = await mediaBytes(allMediaIds(game))
    const big = size > BIG_ZIP
    setBusy(`Собираю файл «${game.title}» (около ${formatSize(size)})…${big ? ' Файл большой — это может занять несколько минут.' : ''}`)
    try {
      const zip = await exportGame(game)
      const url = URL.createObjectURL(zip)
      const link = document.createElement('a')
      link.href = url
      link.download = exportFileName(game)
      link.click()
      markExported(game.id)
      setExported(exportedAt())
      setMessage({ text: `Файл «${exportFileName(game)}» (${formatSize(zip.size)}) сохранён в папку загрузок.` })
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      const hint = big
        ? ` Файл получается около ${formatSize(size)} — закройте другие вкладки и попробуйте снова или сожмите видео (программа HandBrake).`
        : ''
      setMessage({ text: `Не получилось собрать файл игры.${hint}`, error: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col gap-8 bg-bg px-12 py-10 text-white">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl">СВОЯ ИГРА</h1>
        <p className="text-muted">Соберите игру для своей компании или друзей. Ничего не нужно устанавливать.</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <a href="#/new" className="flex flex-col gap-2 rounded-2xl bg-white p-6 text-black hover:opacity-90">
          <span className="text-xl font-bold">Быстрая игра</span>
          <span className="text-sm text-neutral-700">
            3 шага: название, вопросы, команды. Около 5 минут, если вопросы уже есть в таблице.
          </span>
        </a>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-cell p-6 opacity-60">
          <span className="text-xl font-bold">Из шаблона</span>
          <span className="text-sm text-muted">Скоро</span>
        </div>
        <label className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-line bg-cell p-6 hover:border-white focus-within:border-white">
          <span className="text-xl font-bold">Открыть файл игры</span>
          <span className="text-sm text-muted">Файл .zip, который сохранили кнопкой «Отправить файлом», — со всеми картинками и музыкой.</span>
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={!!busy}
            className="sr-only"
            onChange={(e) => {
              void openFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {(busy || message) && (
        <p
          role={message?.error ? 'alert' : 'status'}
          className={`rounded-lg px-4 py-3 text-sm ${message?.error ? 'border border-white' : 'bg-cell'}`}
        >
          {busy ?? message?.text}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted">
          МОИ ИГРЫ{games ? ` · ${games.length}` : ''}
        </h2>

        {games === null && <span className="text-muted">Загрузка…</span>}

        {games?.map((game) => {
          const categories = game.rounds.reduce((n, r) => n + r.categories.length, 0)
          const questions = game.rounds.reduce(
            (n, r) => n + r.categories.reduce((m, c) => m + c.questions.length, 0),
            0,
          )
          const date = game.updatedAt ? new Date(game.updatedAt).toLocaleDateString('ru-RU') : ''
          const copyAt = exported[game.id]
          // Есть ли свежая копия файлом: после неё игру не меняли
          const copy = !copyAt
            ? 'копии файлом нет'
            : copyAt >= (game.updatedAt ?? 0)
              ? `копия файлом ${new Date(copyAt).toLocaleDateString('ru-RU')} ✓`
              : `копия файлом ${new Date(copyAt).toLocaleDateString('ru-RU')}, после неё игру меняли`
          const freshCopy = !!copyAt && copyAt >= (game.updatedAt ?? 0)

          return (
            <div
              key={game.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-line px-5 py-4"
            >
              <div className="min-w-60 flex-1">
                <div className="text-lg font-semibold">{game.title}</div>
                <div className="text-sm text-muted">
                  {categories} категорий · {questions} вопросов{date ? ` · изменена ${date}` : ''}
                </div>
                <div className="text-sm text-muted">
                  {hasSavedState(game.id) && <span className="font-semibold text-white">▶ партия идёт, счёт сохранён · </span>}
                  <span className={freshCopy ? '' : 'text-white'}>{copy}</span>
                </div>
              </div>
              <a
                href={`#/play/${encodeURIComponent(game.id)}`}
                className="flex h-11 items-center rounded-lg bg-white px-5 font-semibold text-black hover:opacity-90"
              >
                Играть
              </a>
              <a
                href={`#/edit/${encodeURIComponent(game.id)}`}
                className="flex h-11 items-center rounded-lg border border-line px-4 hover:bg-cell"
              >
                Изменить
              </a>
              <a
                href={`#/teams/${encodeURIComponent(game.id)}`}
                className="flex h-11 items-center rounded-lg border border-line px-4 hover:bg-cell"
              >
                Команды · {game.teams.length}
              </a>
              <button
                type="button"
                onClick={() => sendFile(game)}
                disabled={!!busy}
                className="h-11 rounded-lg border border-line px-4 hover:bg-cell disabled:opacity-40"
              >
                Отправить файлом
              </button>
              <button
                type="button"
                onClick={() => duplicate(game)}
                className="h-11 rounded-lg border border-line px-4 hover:bg-cell"
              >
                Дублировать
              </button>
              <button
                type="button"
                onClick={() => remove(game)}
                className="h-11 rounded-lg border border-line px-4 hover:bg-cell"
              >
                Удалить
              </button>
            </div>
          )
        })}

        <p className="text-sm text-muted">
          {used !== null && `Игры и файлы занимают ${formatSize(used)}. `}
          {safe === true && 'Браузер обещал не стирать их сам. '}
          {safe === false && 'Браузер может стереть их сам, если на диске мало места, — перед важной игрой сохраните копию файлом. '}
          Игры хранятся в этом браузере. Чтобы перенести игру на другой ноутбук, нажмите «Отправить файлом» и откройте
          этот файл там.
        </p>
        {unused && unused.ids.length > 0 && (
          <button
            type="button"
            onClick={removeUnused}
            className="h-11 self-start rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            Убрать ненужные файлы · {unused.ids.length} · {formatSize(unused.bytes)}
          </button>
        )}
      </section>
    </div>
  )
}

// 123 456 789 байт → «118 МБ»
function formatSize(bytes: number) {
  const mb = bytes / 1024 / 1024
  if (mb < 1) return 'меньше 1 МБ'
  if (mb < 1024) return `${Math.round(mb)} МБ`
  return `${(mb / 1024).toFixed(1).replace('.', ',')} ГБ`
}
