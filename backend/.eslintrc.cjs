module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  env: {
    node: true,
    jest: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    // Existing backend modules contain legacy unused imports/variables.
    // Keep lint actionable while that backlog is cleaned up incrementally.
    '@typescript-eslint/no-unused-vars': 'off',
    'no-unused-vars': 'off',
    'no-case-declarations': 'off',
  },
};
