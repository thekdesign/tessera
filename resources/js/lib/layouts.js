/**
 * 版型以「分割樹」描述：
 *   leaf  = 一格照片
 *   split = { dir: 'row' | 'col', ratios, children }
 *     row：子節點左右並排；col：子節點上下堆疊
 * ratios 加總為 1，分隔線拖曳時只改相鄰兩格的比例。
 * 照片格的順序 = 樹的深度優先走訪順序。
 */

const L = () => ({type: 'leaf'});

const split = (dir) => (...args) => {
    const weights = Array.isArray(args[0]) ? args.shift() : args.map(() => 1);
    const sum = weights.reduce((a, b) => a + b, 0);
    return {
        type: 'split',
        dir,
        ratios: weights.map((w) => w / sum),
        children: args,
    };
};

const R = split('row');
const C = split('col');

const repeat = (n, fn) => Array.from({length: n}, fn);

export const LAYOUTS = [
    {id: '1', tree: L()},

    {id: '2-r', tree: R(L(), L())},
    {id: '2-c', tree: C(L(), L())},
    {id: '2-r21', tree: R([2, 1], L(), L())},
    {id: '2-c21', tree: C([2, 1], L(), L())},

    {id: '3-r', tree: R(L(), L(), L())},
    {id: '3-c', tree: C(L(), L(), L())},
    {id: '3-l1r2', tree: R(L(), C(L(), L()))},
    {id: '3-l2r1', tree: R(C(L(), L()), L())},
    {id: '3-t1b2', tree: C(L(), R(L(), L()))},
    {id: '3-t2b1', tree: C(R(L(), L()), L())},

    {id: '4-grid', tree: C(R(L(), L()), R(L(), L()))},
    {id: '4-r', tree: R(...repeat(4, L))},
    {id: '4-c', tree: C(...repeat(4, L))},
    {id: '4-l1r3', tree: R([2, 1], L(), C(L(), L(), L()))},
    {id: '4-t1b3', tree: C([2, 1], L(), R(L(), L(), L()))},
    {id: '4-stagger', tree: R(C([3, 2], L(), L()), C([2, 3], L(), L()))},

    {id: '5-t2b3', tree: C(R(L(), L()), R(L(), L(), L()))},
    {id: '5-t3b2', tree: C(R(L(), L(), L()), R(L(), L()))},
    {id: '5-l1grid', tree: R(L(), C(R(L(), L()), R(L(), L())))},
    {id: '5-center', tree: R([1, 2, 1], C(L(), L()), L(), C(L(), L()))},

    {id: '6-g32', tree: C(R(L(), L(), L()), R(L(), L(), L()))},
    {id: '6-g23', tree: C(R(L(), L()), R(L(), L()), R(L(), L()))},
    {id: '6-feature', tree: C([2, 1], R([2, 1], L(), C(L(), L())), R(L(), L(), L()))},

    {id: '7-t3b4', tree: C(R(L(), L(), L()), R(...repeat(4, L)))},
    {id: '7-center', tree: R([1, 2, 1], C(L(), L(), L()), L(), C(L(), L(), L()))},

    {id: '8-g42', tree: C(R(...repeat(4, L)), R(...repeat(4, L)))},
    {id: '8-feature', tree: C([2, 1, 1], R(L(), L()), R(L(), L(), L()), R(L(), L(), L()))},

    {id: '9-grid', tree: C(...repeat(3, () => R(L(), L(), L())))},
    {id: '9-center', tree: C([1, 2, 1], R(L(), L(), L()), R([1, 2, 1], L(), L(), L()), R(L(), L(), L()))},
];

export const DEFAULT_LAYOUT_ID = '4-grid';

export function countLeaves(node) {
    if (node.type === 'leaf') return 1;
    return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

export function findLayout(id) {
    return LAYOUTS.find((layout) => layout.id === id);
}

export function cloneTree(node) {
    return JSON.parse(JSON.stringify(node));
}

/** 依格數分組，給版型面板使用 */
export function groupLayoutsByCount() {
    const groups = new Map();
    for (const layout of LAYOUTS) {
        const n = countLeaves(layout.tree);
        if (!groups.has(n)) groups.set(n, []);
        groups.get(n).push(layout);
    }
    return [...groups.entries()].map(([count, layouts]) => ({count, layouts}));
}
