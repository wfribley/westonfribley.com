module.exports = {
  env: {
    node: true,
  },
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'simple-import-sort',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'quotes': ['error', 'single'],
    'semi': ['error', 'never'],
    'simple-import-sort/imports': ['error', { groups: [['^\\u0000', '^@?\\w', '^', '^\\.']] }],
  },
}