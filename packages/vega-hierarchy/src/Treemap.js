import HierarchyLayout from './HierarchyLayout.js';
import {error, hasOwnProperty, inherits} from 'vega-util';
import {
  treemap,
  treemapBinary,
  treemapDice,
  treemapResquarify,
  treemapSlice,
  treemapSliceDice,
  treemapSquarify
} from 'd3-hierarchy';

const Tiles = {
  binary: treemapBinary,
  dice: treemapDice,
  slice: treemapSlice,
  slicedice: treemapSliceDice,
  squarify: treemapSquarify,
  resquarify: treemapResquarify
};

const Output = ['x0', 'y0', 'x1', 'y1', 'depth', 'children'];

/**
 * Treemap layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - The value field to size nodes.
 */
export default function Treemap(params) {
  HierarchyLayout.call(this, params);
}

Treemap.Definition = {
  'type': 'Treemap',
  'metadata': {'tree': true, 'modifies': true},
  'params': [
    { 'name': 'field', 'type': 'field' },
    { 'name': 'sort', 'type': 'compare' },
    { 'name': 'method', 'type': 'enum', 'default': 'squarify',
      'values': ['squarify', 'resquarify', 'binary', 'dice', 'slice', 'slicedice'] },
    { 'name': 'padding', 'type': 'number', 'default': 0 },
    { 'name': 'paddingInner', 'type': 'number', 'default': 0 },
    { 'name': 'paddingOuter', 'type': 'number', 'default': 0 },
    { 'name': 'paddingTop', 'type': 'number', 'default': 0 },
    { 'name': 'paddingRight', 'type': 'number', 'default': 0 },
    { 'name': 'paddingBottom', 'type': 'number', 'default': 0 },
    { 'name': 'paddingLeft', 'type': 'number', 'default': 0 },
    { 'name': 'ratio', 'type': 'number', 'default': 1.618033988749895 },
    { 'name': 'round', 'type': 'boolean', 'default': false },
    { 'name': 'size', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'as', 'type': 'string', 'array': true, 'length': Output.length, 'default': Output }
  ]
};

inherits(Treemap, HierarchyLayout, {
  /**
   * Treemap layout generator. Adds 'method' and 'ratio' parameters
   * to configure the underlying tile method.
   */
  layout() {
    const x = treemap();

    x.ratio = _ => {
      const t = x.tile();
      if (t.ratio) x.tile(t.ratio(_));
    };

    x.method = _ => {
      if (hasOwnProperty(Tiles, _)) x.tile(Tiles[_]);
      else error('Unrecognized Treemap layout method: ' + _);
    };

    return x;
  },

  params: [
    'method', 'ratio', 'size', 'round',
    'padding', 'paddingInner', 'paddingOuter',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'
  ],

  fields: Output
});
