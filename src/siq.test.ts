import { describe, expect, it } from 'vitest'
import { gameProblems } from './game'
import { repairGame } from './repairGame'
import { browserCanPlay, decodeName, replaceMedia, siqMediaType, siqToGame, topPrice } from './siq'
import { parseXml } from './xml'

// Старый формат (SIGame до 7-й версии): scenario из atom, вид вопроса — <type>
const V4 = `<?xml version="1.0" encoding="utf-8"?>
<package name="Тестовый пакет" version="4" xmlns="http://vladimirkhil.com/ygpackage3.0.xsd">
  <rounds>
    <round name="1-й раунд">
      <themes>
        <theme name="Кино &amp; музыка">
          <questions>
            <question price="100">
              <scenario><atom>Кто на фото?</atom><atom type="image">@%D0%9A%D0%BE%D1%82.jpg</atom></scenario>
              <right><answer>Матроскин</answer><answer>Кот Матроскин</answer></right>
              <wrong><answer>Шарик</answer></wrong>
              <info><comments>Из мультфильма</comments></info>
            </question>
            <question price="200">
              <type name="cat"><param name="theme">Мультфильмы</param><param name="cost">500</param></type>
              <scenario><atom type="say">Внимание, кот!</atom><atom>Что за песня?</atom><atom type="voice">@song.mp3</atom><atom type="marker" /><atom type="video">@clip.mp4</atom></scenario>
              <right><answer>Голубой вагон</answer></right>
            </question>
            <question price="300">
              <type name="auction" />
              <scenario><atom>Аукцион</atom><atom type="image">http://example.com/x.jpg</atom></scenario>
              <right><answer>Да</answer></right>
            </question>
            <question price="400">
              <type name="sponsored" />
              <scenario><atom>Спонсор</atom></scenario>
              <right><answer>Нет</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
    <round name="Финал" type="final">
      <themes>
        <theme name="История">
          <questions>
            <question price="0"><scenario><atom>Год крещения Руси?</atom></scenario><right><answer>988</answer></right></question>
            <question price="0"><scenario><atom>Лишний</atom></scenario><right><answer>-</answer></right></question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`

// Новый формат (SIGame 7): params/item, вид вопроса — атрибут type
const V5 = `<?xml version="1.0" encoding="utf-8"?>
<package name="Новый пакет" version="5" xmlns="https://github.com/VladimirKhil/SI/blob/master/assets/siq_5.xsd">
  <rounds>
    <round name="Раунд">
      <themes>
        <theme name="Разное">
          <questions>
            <question price="100">
              <params>
                <param name="question" type="content">
                  <item>Какая это картина?</item>
                  <item type="image" isRef="True">Мона Лиза.png</item>
                  <item placement="replic">Не торопитесь</item>
                </param>
                <param name="answer" type="content"><item type="image" isRef="True">answer.gif</item></param>
              </params>
              <right><answer>Джоконда</answer></right>
            </question>
            <question price="200" type="secret">
              <params>
                <param name="question" type="content"><item>Кот</item></param>
                <param name="theme">Птицы</param>
                <param name="price" type="numberSet"><numberSet minimum="100" maximum="800" step="100" /></param>
                <param name="selectionMode">exceptCurrent</param>
              </params>
              <right><answer>Сова</answer></right>
            </question>
            <question price="300" type="noRisk">
              <params><param name="question" type="content"><item>Без риска</item></param></params>
              <right><answer>Да</answer></right>
            </question>
            <question price="400" type="stake">
              <params><param name="question" type="content"><item>Ставка</item></param></params>
              <right><answer>Да</answer></right>
            </question>
            <question price="500" type="forAll">
              <params>
                <param name="question" type="content"><item>Столица Франции?</item></param>
                <param name="answerType">select</param>
                <param name="answerOptions" type="group">
                  <param name="A" type="content"><item>Париж</item></param>
                  <param name="B" type="content"><item>Лион</item></param>
                </param>
              </params>
              <right><answer>A</answer></right>
            </question>
            <question price="600" type="stakeAll">
              <params><param name="question" type="content"><item>Ставки всех</item></param></params>
              <right><answer>Да</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`

describe('разбор XML', () => {
  it('элементы, атрибуты, спецсимволы, CDATA и комментарии', () => {
    const root = parseXml('<?xml version="1.0"?><!-- c --><a x="1 &lt; 2"><b>Т&#1077;кст</b><c/><d><![CDATA[<сырой>]]></d></a>')
    expect(root.name).toBe('a')
    expect(root.attrs.x).toBe('1 < 2')
    expect(root.children.map((c) => c.name)).toEqual(['b', 'c', 'd'])
    expect(root.children[0].text).toBe('Текст')
    expect(root.children[2].text).toBe('<сырой>')
  })

  it('испорченный XML — понятная ошибка', () => {
    expect(() => parseXml('<a><b></a>')).toThrow(/повреждено/)
    expect(() => parseXml('<a>')).toThrow(/оборвано/)
  })
})

describe('пакет старого формата', () => {
  const { game, files, notes } = siqToGame(parseXml(V4))
  const [cinema] = game.rounds[0].categories
  const [q1, q2, q3, q4] = cinema.questions

  it('название, раунды, темы, цены; три команды для начала', () => {
    expect(game.title).toBe('Тестовый пакет')
    expect(game.rounds.map((r) => [r.title, r.kind])).toEqual([
      ['1-й раунд', 'standard'],
      ['Финал', 'final'],
    ])
    expect(cinema.title).toBe('Кино & музыка')
    expect(cinema.questions.map((q) => q.value)).toEqual([100, 200, 300, 400])
    expect(game.teams).toHaveLength(3)
  })

  it('текст и картинка — один слайд; ответ, неверные ответы и комментарий — ведущему', () => {
    expect(q1.slides).toEqual([{ text: 'Кто на фото?', media: { id: 'siq:Images/Кот.jpg', type: 'image', name: 'Кот.jpg' } }])
    expect(q1.answer.text).toBe('Матроскин')
    expect(q1.hostNote).toBe('Засчитать также: Кот Матроскин\nНеверные ответы: Шарик\nКомментарий: Из мультфильма')
  })

  it('кот: тема и цена; слова ведущего — в заметку; после marker — ответ', () => {
    expect(q2).toMatchObject({ kind: 'cat-in-bag', cat: { theme: 'Мультфильмы', value: 500 } })
    expect(q2.slides).toEqual([{ text: 'Что за песня?', media: { id: 'siq:Audio/song.mp3', type: 'audio', name: 'song.mp3' } }])
    expect(q2.answer).toEqual({ text: 'Голубой вагон', media: { id: 'siq:Video/clip.mp4', type: 'video', name: 'clip.mp4' } })
    expect(q2.hostNote).toBe('Сказать: Внимание, кот!')
  })

  it('аукцион, вопрос от спонсора; ссылка в интернет пропущена', () => {
    expect(q3.kind).toBe('auction')
    expect(q3.slides).toEqual([{ text: 'Аукцион' }])
    expect(q4.special).toEqual({ correct: 2, wrong: 0 }) // в SIGame спонсорский вопрос — удвоенная цена без риска
    // Замена видна и потом — в заметке ведущему у самого вопроса
    expect(q4.hostNote).toBe('Из SIGame: вопрос от спонсора → «×2, без минуса» (перехватить его у нас можно)')
    expect(q3.hostNote).toBe('Из SIGame: файл по ссылке из интернета — пропущен (берём только файлы внутри пакета)')
    expect(files.map((f) => f.key)).toEqual(['siq:Images/Кот.jpg', 'siq:Audio/song.mp3', 'siq:Video/clip.mp4'])
  })

  it('финал: в теме один вопрос; отчёт о заменах', () => {
    expect(game.rounds[1].categories[0].questions).toHaveLength(1)
    expect(game.rounds[1].categories[0].questions[0].answer.text).toBe('988')
    expect(notes).toEqual([
      'файл по ссылке из интернета — пропущен (берём только файлы внутри пакета)',
      'вопрос от спонсора → «×2, без минуса» (перехватить его у нас можно)',
      'в теме финала несколько вопросов — оставлен первый',
    ])
  })
})

describe('пакет нового формата (SIGame 7)', () => {
  const { game, notes } = siqToGame(parseXml(V5))
  const [q1, q2, q3, q4, q5, q6] = game.rounds[0].categories[0].questions

  it('содержимое и ответ из params; реплика ведущего — в заметку', () => {
    expect(q1.slides).toEqual([{ text: 'Какая это картина?', media: { id: 'siq:Images/Мона Лиза.png', type: 'image', name: 'Мона Лиза.png' } }])
    expect(q1.answer).toEqual({ text: 'Джоконда', media: { id: 'siq:Images/answer.gif', type: 'gif', name: 'answer.gif' } })
    expect(q1.hostNote).toBe('Сказать: Не торопитесь')
  })

  it('виды вопросов → ближайшие наши', () => {
    expect(q2).toMatchObject({ kind: 'cat-in-bag', cat: { theme: 'Птицы', value: 800 } })
    expect(q3.special).toEqual({ correct: 2, wrong: 0 })
    expect(q4.kind).toBe('auction')
    expect(q5.special).toEqual({ forAll: true })
    expect(q5.slides.map((s) => s.text)).toEqual(['Столица Франции?\nA) Париж\nB) Лион'])
    expect(q6.special).toEqual({ forAll: true })
  })

  it('отчёт: что заменено', () => {
    expect(notes).toEqual([
      'кот, которого нельзя оставить себе → у нас его можно отдать и себе',
      'кот с выбором цены → цена кота — самая большая из возможных',
      'вопрос без риска → «×2, без минуса» (перехватить его у нас можно)',
      'варианты ответа → дописаны в текст вопроса',
      'ставки всех команд → вопрос «для всех команд» за его стоимость',
    ])
  })
})

// Случаи из настоящих пакетов SIGame (тестовые пакеты из репозитория программы, 27.11.2026)
describe('пакет: как в настоящих пакетах', () => {
  const wrap = (questions: string, extra = '') =>
    `<package name="П"><rounds><round name="Р"><themes><theme name="Т">${extra}<questions>${questions}</questions></theme></themes></round></rounds></package>`
  const qs = (xml: string) => siqToGame(parseXml(xml)).game.rounds[0].categories[0].questions

  it('картинки, показанные вместе (waitForFinish="False"), — на одном слайде; текст под картинкой — тоже', () => {
    const img = (n: string, together = true) => `<item type="image" isRef="True"${together ? ' waitForFinish="False"' : ''}>${n}.jpeg</item>`
    const [many, under, over] = qs(
      wrap(
        `<question price="100"><params><param name="question" type="content">${img('a')}${img('b')}${img('c')}${img('d', false)}</param></params><right><answer>О</answer></right></question>` +
          `<question price="200"><params><param name="question" type="content">${img('e')}<item>Текст под изображением</item></param></params><right><answer>О</answer></right></question>` +
          `<question price="300"><params><param name="question" type="content"><item waitForFinish="False">Текст над</item>${img('f', false)}</param></params><right><answer>О</answer></right></question>`,
      ),
    )
    expect(many.slides).toHaveLength(1)
    expect([many.slides[0].media?.name, ...(many.slides[0].more ?? []).map((m) => m.name)]).toEqual(['a.jpeg', 'b.jpeg', 'c.jpeg', 'd.jpeg'])
    expect(under.slides).toEqual([{ media: { id: 'siq:Images/e.jpeg', type: 'image', name: 'e.jpeg' }, text: 'Текст под изображением' }])
    expect(over.slides).toHaveLength(1)
  })

  it('цена кота: диапазон — самая большая достижимая; 0 — самая дорогая в раунде; одно число — оно', () => {
    const bag = (cost: string, price = 100) =>
      `<question price="${price}"><type name="bagcat"><param name="theme">Новая тема</param><param name="cost">${cost}</param><param name="self">true</param><param name="knows">after</param></type><scenario><atom>Кот</atom></scenario><right><answer>О</answer></right></question>`
    const set = (min: number, max: number, step: number) =>
      `<question price="100" type="secret"><params><param name="price" type="numberSet"><numberSet minimum="${min}" maximum="${max}" step="${step}" /></param><param name="question" type="content"><item>Кот</item></param></params><right><answer>О</answer></right></question>`
    const cats = qs(wrap(bag('[100;1000]/200') + bag('[100;500]') + bag('0') + bag('2000') + set(100, 1000, 200) + set(0, 0, 0) + set(700, 700, 0) + `<question price="1500"><scenario><atom>Самый дорогой</atom></scenario><right><answer>О</answer></right></question>`))
    expect(cats.slice(0, 7).map((q) => q.cat?.value ?? q.value)).toEqual([900, 500, 1500, 2000, 900, 1500, 700])
  })

  it('кот без вопроса (secretNoQuestion и knows="never") — понятный текст вместо пустого слайда', () => {
    const [v5, v4] = qs(
      wrap(
        '<question price="700" type="secretNoQuestion"><params><param name="price" type="numberSet"><numberSet minimum="700" maximum="700" step="0" /></param><param name="selectionMode">exceptCurrent</param></params><right><answer /></right></question>' +
          '<question price="700"><type name="bagcat"><param name="theme">-</param><param name="cost">700</param><param name="self">false</param><param name="knows">never</param></type><scenario><atom>Если указан режим «Никогда», вопрос не задаётся</atom></scenario><right><answer /></right></question>',
      ),
    )
    expect(v5).toMatchObject({ kind: 'cat-in-bag', slides: [{ text: 'Кот в мешке без вопроса: очки достаются команде, которой его отдали' }], answer: { text: 'Очки ваши!' } })
    expect(v5.cat).toBeUndefined() // цена как в ячейке, темы нет
    expect(v4.cat).toBeUndefined() // тема «-» — это «без темы»
    expect(v4.hostNote).toContain('кот без вопроса')
  })

  it('цена -1 — пустое место в теме: вопроса нет; комментарий к теме и числовой ответ — ведущему', () => {
    const [q1, q2] = qs(
      wrap(
        '<question price="100"><params><param name="question" type="content"><item>Год?</item></param><param name="answerType">number</param><param name="answerDeviation">5</param></params><right><answer>1975</answer></right></question>' +
          '<question price="-1"><params /><right /></question><question price="300"><params><param name="question" type="content"><item>Ещё</item></param></params><right><answer>О</answer></right></question>',
        '<info><comments>Назовите исполнителя</comments></info>',
      ),
    )
    expect([q1.value, q2.value]).toEqual([100, 300])
    expect(q1.hostNote).toBe('К теме: Назовите исполнителя\nЧисловой ответ: засчитать, если отличается не больше чем на 5')
  })

  it('диапазон цены: самая большая достижимая', () => {
    expect(topPrice({ min: 100, max: 1000, step: 200 })).toBe(900)
    expect(topPrice({ min: 100, max: 500, step: 0 })).toBe(500)
  })
})

describe('пакет: края', () => {
  it('тема длиннее 10 вопросов делится; цена без числа — по порядку', () => {
    const questions = Array.from({ length: 12 }, (_, i) => `<question price="${i === 0 ? '' : (i + 1) * 100}"><scenario><atom>В${i}</atom></scenario><right><answer>О</answer></right></question>`).join('')
    const { game, notes } = siqToGame(parseXml(`<package name="Длинный"><rounds><round name="Р"><themes><theme name="Т"><questions>${questions}</questions></theme></themes></round></rounds></package>`))
    expect(game.rounds[0].categories.map((c) => [c.title, c.questions.length])).toEqual([
      ['Т (1)', 10],
      ['Т (2)', 2],
    ])
    expect(game.rounds[0].categories[0].questions[0].value).toBe(100)
    expect(notes).toEqual(['тема длиннее 10 вопросов — разделена на несколько категорий'])
  })

  it('не пакет или пустой пакет — понятная ошибка', () => {
    expect(() => siqToGame(parseXml('<game/>'))).toThrow(/не пакет SIGame/)
    expect(() => siqToGame(parseXml('<package><rounds/></package>'))).toThrow(/нет ни одного раунда/)
  })

  it('подстановка файлов: найденные — в игру, ненайденные убираются; игра проходит починку и проверку', () => {
    const { game } = siqToGame(parseXml(V4))
    const saved = new Map([
      ['siq:Images/Кот.jpg', { id: 'm1', type: 'image' as const, name: 'Кот.jpg' }],
      ['siq:Audio/song.mp3', null],
      ['siq:Video/clip.mp4', { id: 'm3', type: 'video' as const, name: 'clip.mp4' }],
    ])
    const fixed = repairGame(JSON.parse(JSON.stringify(replaceMedia(game, saved))))!
    const [q1, q2] = fixed.rounds[0].categories[0].questions
    expect(q1.slides[0].media?.id).toBe('m1')
    expect(q2.slides[0]).toEqual({ text: 'Что за песня?' })
    expect(q2.answer.media?.id).toBe('m3')
    expect(q2.hostNote).toBe('Сказать: Внимание, кот!\nНе перенёсся файл: song.mp3 (нет в пакете или браузер его не покажет)')
    expect(q1.hostNote).not.toContain('Не перенёсся')
    expect(gameProblems(fixed)).toEqual([])
  })

  it('имена файлов: %-кодировка и тип по расширению', () => {
    expect(decodeName('%D0%9A%D0%BE%D1%82.jpg')).toBe('Кот.jpg')
    expect(decodeName('100%.jpg')).toBe('100%.jpg')
    expect(siqMediaType('a.GIF', 'Images')).toBe('gif')
    expect(siqMediaType('a.xyz', 'Audio')).toBe('audio')
    expect(browserCanPlay('клип.WMV')).toBe(false)
    expect(browserCanPlay('звук.wma')).toBe(false)
    expect(browserCanPlay('клип.mp4')).toBe(true)
  })
})
