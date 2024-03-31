function template(options) {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${options.title}</title>
  </head>
  <body>
    <script src="${options.files.js[0].fileName}"></script>
    <script src="https://cdn.jsdelivr.net/npm/localforage/dist/localforage.min.js"></script>
  </body>
</html>
`
}

export default template
