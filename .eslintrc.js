// TODO: Unified .eslintrc.js for all Synaptic projects
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        '@flybywiresim/eslint-config',
    ],
    rules: {
        'import/no-unresolved': 'off',
        'no-undef': 'off',
        'no-nested-ternary': 'off',
        'linebreak-style': 'off',
        'no-underscore-dangle': 'off',
        'react/jsx-one-expression-per-line': 'off',
        '@typescript-eslint/consistent-type-definitions': 'error',
        '@typescript-eslint/member-delimiter-style': ['error', { singleline: { delimiter: 'comma' } }],
        'indent': ['error', 4, { SwitchCase: 1 }],
        'default-case': 'off',
    },
};
