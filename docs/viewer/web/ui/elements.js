export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child !== undefined && child !== null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function link(label, href, className = '') {
  return element('a', {href, class: className}, [label]);
}

export function route(values) { return '#' + new URLSearchParams(values).toString(); }
export function fileLink(id) { return '/file?' + new URLSearchParams({id}).toString(); }

export function button(label, action) {
  const node = element('button', {type: 'button'}, [label]);
  node.addEventListener('click', action);
  return node;
}
