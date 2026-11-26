// Маленький разбор XML — для описания пакетов SIGame (content.xml). Свой, а не DOMParser браузера,
// чтобы тот же код работал и в автопроверках. Понимает элементы, атрибуты, текст, CDATA, комментарии
// и спецсимволы (&amp;, &#1234; …). Приставки имён (ns:) отбрасывает.

export type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

const localName = (name: string) => name.slice(name.indexOf(':') + 1)

// Разобрать XML в дерево. Испорченный XML — ошибка с понятным текстом.
export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' }
  const stack: XmlNode[] = [root]
  let i = 0
  const s = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source // без метки BOM
  while (i < s.length) {
    const lt = s.indexOf('<', i)
    const top = stack[stack.length - 1]
    if (lt < 0) {
      top.text += decode(s.slice(i))
      break
    }
    if (lt > i) top.text += decode(s.slice(i, lt))
    if (s.startsWith('<!--', lt)) {
      const end = s.indexOf('-->', lt)
      i = end < 0 ? s.length : end + 3
    } else if (s.startsWith('<![CDATA[', lt)) {
      const end = s.indexOf(']]>', lt)
      top.text += s.slice(lt + 9, end < 0 ? s.length : end)
      i = end < 0 ? s.length : end + 3
    } else if (s.startsWith('<?', lt) || s.startsWith('<!', lt)) {
      const end = s.indexOf('>', lt)
      i = end < 0 ? s.length : end + 1
    } else if (s[lt + 1] === '/') {
      const end = s.indexOf('>', lt)
      const name = localName(s.slice(lt + 2, end).trim())
      if (top.name !== name) throw new Error(`Описание пакета повреждено: ожидался конец <${top.name}>, а встретился </${name}>.`)
      stack.pop()
      i = end + 1
    } else {
      // Открывающий тег: имя, атрибуты в кавычках, может закрываться сам (/>)
      const tag = /^<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/.exec(s.slice(lt))
      if (!tag) throw new Error('Описание пакета повреждено: не получилось прочитать тег.')
      const node: XmlNode = { name: localName(tag[1]), attrs: {}, children: [], text: '' }
      for (const a of tag[2].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) node.attrs[localName(a[1])] = decode(a[2] ?? a[3] ?? '')
      top.children.push(node)
      if (!tag[3]) stack.push(node)
      i = lt + tag[0].length
    }
  }
  if (stack.length > 1) throw new Error(`Описание пакета оборвано: не закрыт <${stack[stack.length - 1].name}>.`)
  const first = root.children[0]
  if (!first) throw new Error('Описание пакета пустое.')
  return first
}

// Дочерние элементы с таким именем
export const kids = (node: XmlNode | undefined, name: string) => node?.children.filter((c) => c.name === name) ?? []

// Первый дочерний элемент с таким именем
export const kid = (node: XmlNode | undefined, name: string) => node?.children.find((c) => c.name === name)

// Путь вниз: path(package, 'rounds', 'round') — все round внутри rounds
export function path(node: XmlNode | undefined, ...names: string[]): XmlNode[] {
  let level = node ? [node] : []
  for (const name of names) level = level.flatMap((n) => kids(n, name))
  return level
}

// Текст элемента без пробелов по краям
export const textOf = (node: XmlNode | undefined) => node?.text.trim() ?? ''
