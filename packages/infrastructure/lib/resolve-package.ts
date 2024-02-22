import { dirname, join } from "path";

export function resolvePackage(packageName: string): string {
    return dirname(require.resolve(join(packageName, 'package.json')))
}
