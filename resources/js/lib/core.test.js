import {describe, expect, it} from 'vitest';
import {LAYOUTS, countLeaves} from './layouts.js';
import {computeLayout, shiftRatios, MIN_RATIO} from './geometry.js';
import {computePlacement, panBy} from './placement.js';
import {applyToPixels, resolveParams, isIdentity} from './adjust.js';
import {exportDimensions} from './exporter.js';

describe('layouts', () => {
    it('每個版型 id 唯一、ratios 加總為 1', () => {
        expect(new Set(LAYOUTS.map((l) => l.id)).size).toBe(LAYOUTS.length);
        const walk = (n) => {
            if (n.type === 'leaf') return;
            expect(n.ratios.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
            expect(n.ratios).toHaveLength(n.children.length);
            n.children.forEach(walk);
        };
        LAYOUTS.forEach((l) => walk(l.tree));
    });

    it('版型 id 開頭的數字等於格數', () => {
        for (const l of LAYOUTS) expect(countLeaves(l.tree)).toBe(Number(l.id.split('-')[0]));
    });
});

describe('computeLayout', () => {
    const grid = LAYOUTS.find((l) => l.id === '4-grid').tree;

    it('2×2 無邊框無間距時剛好鋪滿', () => {
        const {cells, dividers} = computeLayout(grid, 1000, 1000);
        expect(cells).toEqual([
            {x: 0, y: 0, w: 500, h: 500},
            {x: 500, y: 0, w: 500, h: 500},
            {x: 0, y: 500, w: 500, h: 500},
            {x: 500, y: 500, w: 500, h: 500},
        ]);
        expect(dividers).toHaveLength(3);
    });

    it('外框與間距以短邊千分比換算', () => {
        const {cells} = computeLayout(grid, 2000, 1000, {border: 20, gap: 10});
        // unit = 1px，外框 20px、間距 10px
        expect(cells[0]).toEqual({x: 20, y: 20, w: 975, h: 475});
        expect(cells[3].x + cells[3].w).toBeCloseTo(1980);
        expect(cells[3].y + cells[3].h).toBeCloseTo(980);
    });
});

describe('shiftRatios', () => {
    it('只改相鄰兩格、總和不變、不低於最小比例', () => {
        const next = shiftRatios([0.5, 0.5], 0, 100, 1000);
        expect(next[0]).toBeCloseTo(0.6);
        expect(next[1]).toBeCloseTo(0.4);
        const clamped = shiftRatios([0.5, 0.5], 0, 10_000, 1000);
        expect(clamped[1]).toBeCloseTo(MIN_RATIO);
        expect(clamped[0] + clamped[1]).toBeCloseTo(1);
    });
});

describe('placement', () => {
    it('預設 cover：橫圖放進正方格，高度剛好貼齊', () => {
        const p = computePlacement(100, 100, 400, 200);
        expect(p.scale).toBeCloseTo(0.5);
        expect(p.overflowX).toBeCloseTo(50);
        expect(p.overflowY).toBe(0);
    });

    it('旋轉 90° 時以轉後的長寬計算', () => {
        const p = computePlacement(100, 100, 400, 200, {rotation: 90});
        expect(p.overflowY).toBeCloseTo(50);
        expect(p.overflowX).toBe(0);
    });

    it('平移會被夾在可移動範圍內，沒有溢出的方向不動', () => {
        const p = computePlacement(100, 100, 400, 200);
        const next = panBy({panX: 0.9, panY: 0}, 30, 30, p);
        expect(next.panX).toBe(1);
        expect(next.panY).toBe(0);
    });
});

describe('adjust', () => {
    it('原圖濾鏡不改像素', () => {
        const p = resolveParams('none');
        expect(isIdentity(p)).toBe(true);
        const data = new Uint8ClampedArray([10, 120, 250, 255]);
        applyToPixels(data, p);
        expect([...data]).toEqual([10, 120, 250, 255]);
    });

    it('黑白濾鏡讓三通道相等', () => {
        const data = new Uint8ClampedArray([200, 80, 30, 255]);
        applyToPixels(data, resolveParams('mono'));
        expect(data[0]).toBe(data[1]);
        expect(data[1]).toBe(data[2]);
    });

    it('滑桿疊加在濾鏡上', () => {
        expect(resolveParams('warm', {brightness: 10, contrast: 0, saturation: 0, warmth: 0, fade: 0}).brightness).toBe(14);
    });
});

describe('exportDimensions', () => {
    it('依長邊換算，並限制在 iOS canvas 面積上限內', () => {
        expect(exportDimensions({w: 4, h: 5}, 1080)).toEqual({width: 864, height: 1080});
        const big = exportDimensions({w: 1, h: 1}, 4096);
        expect(big.width * big.height).toBeLessThanOrEqual(16_000_000);
    });
});
