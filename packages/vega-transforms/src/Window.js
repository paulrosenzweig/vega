import {groupkey} from './util/AggregateKeys.js';
import {ValidAggregateOps} from './util/AggregateOps.js';
import SortedList from './util/SortedList.js';
import {ValidWindowOps} from './util/WindowOps.js';
import WindowState from './util/WindowState.js';
import {Transform, stableCompare, tupleid} from 'vega-dataflow';
import {constant, inherits} from 'vega-util';
import {bisector} from 'd3-array';

/**
 * Perform window calculations and write results to the input stream.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(*,*): number} [params.sort] - A comparator function for sorting tuples within a window.
 * @param {Array<function(object): *>} [params.groupby] - An array of accessors by which to partition tuples into separate windows.
 * @param {Array<string>} params.ops - An array of strings indicating window operations to perform.
 * @param {Array<function(object): *>} [params.fields] - An array of accessors
 *   for data fields to use as inputs to window operations.
 * @param {Array<*>} [params.params] - An array of parameter values for window operations.
 * @param {Array<number>} [params.aggregate_params] - An optional array of parameter values for aggregation operations.
 * @param {Array<string>} [params.as] - An array of output field names for window operations.
 * @param {Array<number>} [params.frame] - Window frame definition as two-element array.
 * @param {boolean} [params.ignorePeers=false] - If true, base window frame boundaries on row
 *   number alone, ignoring peers with identical sort values. If false (default),
 *   the window boundaries will be adjusted to include peer values.
 */
export default function Window(params) {
  Transform.call(this, {}, params);
  this._mlen = 0;
  this._mods = [];
}

Window.Definition = {
  'type': 'Window',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'sort', 'type': 'compare' },
    { 'name': 'groupby', 'type': 'field', 'array': true },
    { 'name': 'ops', 'type': 'enum', 'array': true, 'values': ValidWindowOps.concat(ValidAggregateOps) },
    { 'name': 'params', 'type': 'number', 'null': true, 'array': true },
    { 'name': 'aggregate_params', 'type': 'number', 'null': true, 'array': true},
    { 'name': 'fields', 'type': 'field', 'null': true, 'array': true },
    { 'name': 'as', 'type': 'string', 'null': true, 'array': true },
    { 'name': 'frame', 'type': 'number', 'null': true, 'array': true, 'length': 2, 'default': [null, 0] },
    { 'name': 'ignorePeers', 'type': 'boolean', 'default': false }
  ]
};

inherits(Window, Transform, {
  transform(_, pulse) {
    this.stamp = pulse.stamp;

    const mod = _.modified(),
          cmp = stableCompare(_.sort),
          key = groupkey(_.groupby),
          group = t => this.group(key(t));

    // initialize window state
    let state = this.state;
    if (!state || mod) {
      state = this.state = new WindowState(_);
    }

    // partition input tuples
    if (mod || pulse.modified(state.inputs)) {
      this.value = {};
      pulse.visit(pulse.SOURCE, t => group(t).add(t));
    } else {
      pulse.visit(pulse.REM, t => group(t).remove(t));
      pulse.visit(pulse.ADD, t => group(t).add(t));
    }

    // perform window calculations for each modified partition
    for (let i=0, n=this._mlen; i<n; ++i) {
      processPartition(this._mods[i], state, cmp, _);
    }
    this._mlen = 0;
    this._mods = [];

    // TODO don't reflow everything?
    return pulse.reflow(mod).modifies(state.outputs);
  },

  group(key) {
    let group = this.value[key];

    if (!group) {
      group = this.value[key] = SortedList(tupleid);
      group.stamp = -1;
    }

    if (group.stamp < this.stamp) {
      group.stamp = this.stamp;
      this._mods[this._mlen++] = group;
    }

    return group;
  }
});

function processPartition(list, state, cmp, _) {
  const sort = _.sort,
        range = sort && !_.ignorePeers,
        frame = _.frame || [null, 0],
        data = list.data(cmp), // use cmp for stable sort
        n = data.length,
        b = range ? bisector(sort) : null,
        w = {
          i0: 0, i1: 0, p0: 0, p1: 0, index: 0,
          data: data, compare: sort || constant(-1)
        };

  state.init();
  for (let i=0; i<n; ++i) {
    setWindow(w, frame, i, n);
    if (range) adjustRange(w, b);
    state.update(w, data[i]);
  }
}

function setWindow(w, f, i, n) {
  w.p0 = w.i0;
  w.p1 = w.i1;
  w.i0 = f[0] == null ? 0 : Math.max(0, i - Math.abs(f[0]));
  w.i1 = f[1] == null ? n : Math.min(n, i + Math.abs(f[1]) + 1);
  w.index = i;
}

// if frame type is 'range', adjust window for peer values
function adjustRange(w, bisect) {
  const r0 = w.i0,
        r1 = w.i1 - 1,
        c = w.compare,
        d = w.data,
        n = d.length - 1;

  if (r0 > 0 && !c(d[r0], d[r0-1])) w.i0 = bisect.left(d, d[r0]);
  if (r1 < n && !c(d[r1], d[r1+1])) w.i1 = bisect.right(d, d[r1]);
}
