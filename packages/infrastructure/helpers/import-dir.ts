import { dirname, join } from 'path'

export const importDir = (importPath: string): string => {
  const parts = importPath.split('/')
  const moduleName = parts[0].startsWith('@') ? `${parts.shift()}/${parts.shift()}` : parts.shift()

  if (!moduleName) throw new Error(`importDir must be called with a package name, called with "${moduleName}" instead.`)

  // If given just a package name, `require.resolve` will resolve the file named by the
  // "main" field in package.json -- but we just want the root directory of the package.
  // So we'll specifically resolve the package.json file itself (guaranteed to exist) to
  // give us the package directory.
  return join(dirname(require.resolve(join(moduleName, 'package.json'))), ...parts)
}