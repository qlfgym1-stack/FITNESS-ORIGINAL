export function tpl(
  t: (key: string) => string,
  key: string,
  params?: Record<string, string | number>
): string {
  let s = t(key)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v))
    }
  }
  return s
}
