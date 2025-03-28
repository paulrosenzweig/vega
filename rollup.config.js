/* eslint-disable no-console */
import { readFile } from 'fs/promises';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import bundleSize from 'rollup-plugin-bundle-size';

const pkg = JSON.parse(await readFile('./package.json'));

const d3Deps = [
  'd3-array',
  'd3-color',
  'd3-dispatch',
  'd3-dsv',
  'd3-force',
  'd3-format',
  'd3-geo',
  'd3-hierarchy',
  'd3-interpolate',
  'd3-path',
  'd3-scale',
  'd3-shape',
  'd3-time',
  'd3-time-format',
  'd3-timer',
  'd3-delaunay'
];

const esmDeps = [
  ...d3Deps,
  'd3-geo-projection',
  'd3-scale-chromatic'
];

const d3CoreDeps = [
  ...d3Deps,
  'topojson-client'
];

function onwarn(warning, defaultHandler) {
  if (warning.code !== 'CIRCULAR_DEPENDENCY') {
    defaultHandler(warning);
  }
}

/**
 * Command line arguments:
 *  `config-debug`: print debug information about the build
 *  `config-browser`: the module has different inputs for browser and node
 *  `config-bundle`: bundle dependencies in browser output
 *  `config-transform`: the module is a Vega transform
 *  `config-core`: create a bundle without d3
 *  `config-node`: the module is only intended for node
 *  `config-test`: skip bundles not required for tests
 */
export default function(commandLineArgs) {
  const debug = !!commandLineArgs['config-debug'];

  if (debug) {
    console.info(pkg);
    console.info(commandLineArgs);
  }

  const browser = !!pkg.browser;
  const node = !!pkg.exports?.node;
  const bundle = !!commandLineArgs['config-bundle'];
  const test = !!commandLineArgs['config-test'];

  const dependencies = Object.keys(pkg.dependencies || {});
  const coreExternal = d3CoreDeps;
  const vgDependencies = bundle ? [] : dependencies.filter(dep => dep.startsWith('vega-'));

  const name = commandLineArgs['config-transform'] ? 'vega.transforms' : 'vega';

  const globals = {};
  for (const dep of [...dependencies, ...d3CoreDeps]) {
    if (dep.startsWith('d3')) {
      globals[dep] = 'd3';
    } else if (dep.startsWith('vega-')) {
      globals[dep] = 'vega';
    } else if (dep.startsWith('topojson-')) {
      globals[dep] = 'topojson';
    }
  }

  function commonPlugins(targets) {
    if (debug) {
      console.log(targets);
    }

    return [
      json(),
      babel({
        presets: [[
          '@babel/preset-env',
          {
            targets,
            debug
          }
        ]],
        babelHelpers: 'bundled',
        extensions: ['.js', '.ts'],
        generatorOpts: { 'importAttributesKeyword': 'with' }
      }),
      bundleSize()
    ];
  }

  function nodePlugin(browser) {
    return nodeResolve({
      browser,
      modulesOnly: true,
      customResolveOptions: { preserveSymlinks: false }
    });
  }

  const outputs = [{
    input: './index.js',
    external: dependencies,
    onwarn,
    output: {
      file: pkg.exports.default,
      format: 'esm',
      sourcemap: false
    },
    plugins: [nodePlugin(true), ...commonPlugins('defaults, last 1 node versions')]
  }];

  if (node) {
    outputs.push({
      input: './index.js',
      external: dependencies.filter(dep => !esmDeps.includes(dep)),
      onwarn,
      output: {
        file: pkg.exports.node,
        format: 'esm',
        globals,
        sourcemap: false,
        name
      },
      plugins: [nodePlugin(false), ...commonPlugins({node: true})]
    });
  }

  if (browser) {
    outputs.push(
      ...outputs.map(out => ({
        ...out,
        input: './index.browser.js',
        output: {
          ...out.output,
          file: out.output.file.replace('node', 'browser')
        }
      }))
    );
  }

  if (test) {
    return outputs;
  }

  /**
   * If `config-bundle` is true, create minified and long outputs.
   */
  function bundleOutputs(output) {
    if (bundle) {
      return [{
        ...output,
        plugins: [terser()]
      }, {
        ...output,
        sourcemap: false,
        file: output.file.replace('.min', '')
      }];
    } else {
      return {
        ...output,
        plugins: [terser()]
      };
    }
  }

  if (!commandLineArgs['config-node']) {
    outputs.push({
      input: browser ? './index.browser.js' : './index.js',
      external: vgDependencies,
      onwarn,
      output: bundleOutputs({
        file: pkg.unpkg,
        format: 'umd',
        sourcemap: true,
        globals,
        name
      }),
      plugins: [nodePlugin(true), ...commonPlugins('defaults, last 1 node versions')]
    });
  }

  if (commandLineArgs['config-core']) {
    // Create bundle without d3 (core bundle)
    outputs.push({
      input: browser ? './index.browser.js' : './index.js',
      external: [...vgDependencies, ...coreExternal],
      onwarn,
      output: bundleOutputs({
        file: pkg.unpkg.replace('.min.js', '-core.min.js'),
        format: 'umd',
        sourcemap: true,
        globals,
        name
      }),
      plugins: [nodePlugin(true), ...commonPlugins('defaults, last 1 node versions')]
    });
  }

  if (debug) {
    console.info(outputs);
  }

  return outputs;
}
