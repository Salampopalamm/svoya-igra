// Памятка «Как провести игру»: как вывести табло на проектор и какие клавиши нажимать.
// Открывается с пульта (кнопка «Как провести игру») — для тех, кто ведёт игру впервые.

type Props = { onClose: () => void }

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Подключите проектор или телевизор',
    text: 'Кабелем HDMI к ноутбуку. На Windows нажмите Win + P и выберите «Расширить» — тогда у вас будет два разных экрана: пульт на ноутбуке, табло на проекторе. На Mac: Системные настройки → Мониторы, режим «Расширенный рабочий стол», а не «Видеоповтор».',
  },
  {
    title: 'Откройте экран для зала',
    text: 'Кнопка «Открыть экран для зала» на пульте. Появится второе окно — его и увидят зрители.',
  },
  {
    title: 'Перетащите это окно на проектор',
    text: 'Возьмите окно мышкой за верхнюю полосу и тяните за край экрана ноутбука — оно переедет на проектор. Не получается — щёлкните по окну и нажмите Win + Shift + → (стрелка вправо).',
  },
  {
    title: 'Щёлкните по окну на проекторе один раз',
    text: 'Включатся звук и полный экран. На пульте кнопка сменится на «Экран зала открыт · звук вкл». Если полный экран не включился — нажмите F11 в окне зала.',
  },
  {
    title: 'Проверьте звук и файлы заранее',
    text: 'Видео звучит из окна зала, музыка и сигнал таймера — из пульта. Звук идёт туда, куда настроена Windows (в колонки ноутбука или в проектор по HDMI). Откройте вопрос с видео или музыкой до прихода гостей. Строка над табло скажет, все ли файлы игры загрузились.',
  },
]

const KEYS: [string, string][] = [
  ['Клик по ячейке', 'открыть вопрос (красная — уже сыграна: открывается только посмотреть, счёт не меняется)'],
  ['1 … 9, 0', 'выбрать команду: на табло — чей ход, в вопросе — кто отвечает'],
  ['← →', 'листать слайды вопроса'],
  ['Пробел', 'показать ответ в зале'],
  ['+ / −', 'верно / неверно выбранной команде'],
  ['T', 'запустить или остановить таймер'],
  ['Esc', 'закрыть вопрос'],
  ['H', 'скрыть экран зала (например, на перерыв)'],
  ['Ctrl + Z', 'отменить последнее действие'],
  ['P', 'предпросмотр: посмотреть вопрос только у себя, зал его не увидит'],
]

export default function HowToRun({ onClose }: Props) {
  return (
    <>
      {/* Клик мимо панели — закрыть */}
      <button type="button" aria-label="Закрыть памятку" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-black/50" />
      <aside
        role="dialog"
        aria-label="Как провести игру"
        className="fixed inset-y-0 right-0 z-50 flex w-[560px] max-w-full flex-col gap-6 overflow-y-auto border-l border-line bg-bg p-6 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl">КАК ПРОВЕСТИ ИГРУ</h2>
          <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            Закрыть · Esc
          </button>
        </div>
        <p className="text-sm text-muted">
          Пульт — это окно, которое вы видите сейчас: оно остаётся на ноутбуке, его видите только вы. Зрители смотрят на
          второе окно — экран зала.
        </p>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-widest text-muted">ПЕРЕД ИГРОЙ</h3>
          <ol className="flex flex-col gap-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{step.title}</span>
                  <span className="text-sm text-muted">{step.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-widest text-muted">ВО ВРЕМЯ ИГРЫ — КЛАВИШИ</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {KEYS.map(([key, what]) => (
              <div key={key} className="contents">
                <dt className="whitespace-nowrap font-semibold">{key}</dt>
                <dd className="text-muted">{what}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted">Всё то же самое можно делать мышкой — кнопками на пульте.</p>
          <p className="text-sm text-muted">
            Отошли от ноутбука и в руке только мышь? Вопросы можно выбирать прямо на экране зала, а внизу при движении
            мыши всплывёт панель — слайды, таймер, «Верно / Неверно», ответ, «На табло». Панель можно свернуть кнопкой ▾ в
            маленькую «▾ Панель» вверху посередине. Если мышь в зале мешает — выключите в ⚙ «Мышь в зале».
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-widest text-muted">ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted">
            <li>Закрыли окно зала — снова нажмите «Открыть экран для зала»: счёт и табло сохранились.</li>
            <li>Ошиблись со счётом — Ctrl + Z, или нажмите на счёт команды внизу пульта и впишите верный.</li>
            <li>
              Спорят о счёте — «📜 Журнал»: каждый ответ и каждая поправка по порядку, с временем и вопросом. Там же «Сохранить в
              Excel» — результаты для клиента.
            </li>
            <li>
              На проекторе всё мелко или не помещается — ⚙ → «Размеры в зале» (табло, команды, фото, картинки, текст, таймер)
              или ⚙ → «Растянуть в зале»: наведите мышь на ячейку, категорию, команду, текст или картинку в зале — появится
              уголок ◢, тяните его. Каждую ячейку и карточку можно растянуть отдельно; «Готово» — выключить.
            </li>
            <li>
              На пульте «Что-то пошло не так» — нажмите «Закрыть вопрос и вернуться к табло»: счёт сохранён. Зрители ошибку не
              увидят — экран зала на секунду опустеет.
            </li>
            <li>Пульт открыт в двух окнах — пульт предупредит. Закройте лишний, иначе зал будет мигать.</li>
            <li>
              Игра хранится только в этом браузере. Перед важной игрой сохраните копию: «Мои игры» → «Отправить файлом» — у
              игры появится «копия файлом ✓».
            </li>
          </ul>
        </section>
      </aside>
    </>
  )
}
