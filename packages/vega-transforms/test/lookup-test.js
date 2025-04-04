import tape from 'tape';
import {field} from 'vega-util';
import {Dataflow, changeset} from 'vega-dataflow';
import {collect as Collect, lookup as Lookup, tupleindex as TupleIndex} from '../index.js';

tape('Lookup looks up matching tuples', t => {
  const lut = [
    {'id': 1, 'value': 'foo'},
    {'id': 3, 'value': 'bar'},
    {'id': 5, 'value': 'baz'}
  ];

  const data = [
    {'id': 0, 'x': 5, 'y': 1},
    {'id': 1, 'x': 3, 'y': 5},
    {'id': 2, 'x': 1, 'y': 5},
    {'id': 3, 'x': 3, 'y': 3}
  ];

  var uv = field('u.value'),
      vv = field('v.value'),
      id = field('id'),
      x  = field('x'),
      y  = field('y'),

      df = new Dataflow(),
      c0 = df.add(Collect),
      ti = df.add(TupleIndex, {field:id, pulse:c0}),
      c1 = df.add(Collect),
      lk = df.add([x,y]),
      lu = df.add(Lookup, {index:ti, fields:lk, as:['u','v'], pulse:c1});

  df.run(); // initialize

  // add lookup table
  df.pulse(c0, changeset().insert(lut)).run();
  t.equal(ti.value.size, 3);

  // add primary data
  df.pulse(c1, changeset().insert(data)).run();
  let p = lu.pulse.add;
  t.equal(p.length, 4);
  t.deepEqual(p.map(uv), ['baz', 'bar', 'foo', 'bar']);
  t.deepEqual(p.map(vv), ['foo', 'baz', 'baz', 'bar']);

  // swap lookup keys
  df.update(lk, [y,x]).run();
  p = lu.pulse.mod;
  t.equal(p.length, 4);
  t.deepEqual(p.map(vv), ['baz', 'bar', 'foo', 'bar']);
  t.deepEqual(p.map(uv), ['foo', 'baz', 'baz', 'bar']);

  t.end();
});

tape('Lookup looks up matching values', t => {
  const lut = [
    {'id': 1, 'value': 'foo'},
    {'id': 3, 'value': 'bar'},
    {'id': 5, 'value': 'baz'}
  ];

  const data = [
    {'id': 0, 'x': 5, 'y': 1},
    {'id': 1, 'x': 3, 'y': 5},
    {'id': 2, 'x': 1, 'y': 5},
    {'id': 3, 'x': 3, 'y': 3}
  ];

  var value = field('value'),
      id = field('id'),
      x = field('x'),
      y = field('y'),

      df = new Dataflow(),
      c0 = df.add(Collect),
      ti = df.add(TupleIndex, {field:id, pulse:c0}),
      c1 = df.add(Collect),
      lk = df.add([x]),
      lu = df.add(Lookup, {index:ti, fields:lk, values:[value], pulse:c1});

  df.run(); // initialize

  // add lookup table
  df.pulse(c0, changeset().insert(lut)).run();
  t.equal(ti.value.size, 3);

  // add primary data
  df.pulse(c1, changeset().insert(data)).run();
  let p = lu.pulse.add;
  t.equal(p.length, 4);
  t.deepEqual(p.map(value), ['baz', 'bar', 'foo', 'bar']);

  // swap lookup keys
  df.update(lk, [y]).run();
  p = lu.pulse.mod;
  t.equal(p.length, 4);
  t.deepEqual(p.map(value), ['foo', 'baz', 'baz', 'bar']);

  // modify lookup table
  df.pulse(c0, changeset().modify(lut[0], 'value', 'fud')).run();
  p = lu.pulse.mod;
  t.equal(p.length, 4);
  t.deepEqual(p.map(value), ['fud', 'baz', 'baz', 'bar']);

  t.end();
});
