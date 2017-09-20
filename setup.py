#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from __future__ import print_function

#-----------------------------------------------------------------------------
# Minimal Python version sanity check
#-----------------------------------------------------------------------------

import sys

v = sys.version_info
if v[:2] < (2,7) or (v[0] >= 3 and v[:2] < (3,3)):
    error = "ERROR: %s requires Python version 2.7 or 3.3 or above." % name
    print(error, file=sys.stderr)
    sys.exit(1)

PY3 = (sys.version_info[0] >= 3)

#-----------------------------------------------------------------------------
# get on with it
#-----------------------------------------------------------------------------

from distutils import log
import json
import os
from glob import glob

# BEFORE importing distutils, remove MANIFEST. distutils doesn't properly
# update it when the contents of directories change.
if os.path.exists('MANIFEST'): os.remove('MANIFEST')

from distutils.command.build_ext import build_ext
from distutils.command.build_py import build_py
from setuptools.command.sdist import sdist
from setuptools import setup
from setuptools.command.bdist_egg import bdist_egg


# Our own imports
from setupbase import (
    bdist_egg_disabled,
    ensure_core_data,
    find_packages,
    find_package_data,
    js_prerelease,
    CheckAssets,
    CoreDeps,
    version_ns,
    name
)


here = os.path.dirname(os.path.abspath(__file__))
pjoin = os.path.join

DESCRIPTION = 'An alpha preview of the QuantLab notebook server extension.'
LONG_DESCRIPTION = 'This is an alpha preview of QuantLab. It is not ready for general usage yet. Development happens on https://github.com/quantlabio/quantlab.'


setup_args = dict(
    name             = name,
    description      = DESCRIPTION,
    long_description = LONG_DESCRIPTION,
    version          = version_ns['__version__'],
    scripts          = glob(pjoin('scripts', '*')),
    packages         = find_packages(),
    package_data     = find_package_data(),
    author           = 'QuantLab Development Team',
    author_email     = 'quantlab.io@gmail.com',
    url              = 'https://www.quantlab.io',
    license          = 'BSD',
    platforms        = "Linux, Mac OS X, Windows",
    keywords         = ['ipython', 'jupyter', 'Web', 'quant'],
    classifiers      = [
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
    ],
)


cmdclass = dict(
    build_py = ensure_core_data(build_py),
    build_ext = ensure_core_data(build_ext),
    sdist  = js_prerelease(sdist, strict=True),
    bdist_egg = bdist_egg if 'bdist_egg' in sys.argv else bdist_egg_disabled,
    jsdeps = CheckAssets,
    coredeps = CoreDeps,
)
try:
    from wheel.bdist_wheel import bdist_wheel
    cmdclass['bdist_wheel'] = js_prerelease(bdist_wheel, strict=True)
except ImportError:
    pass


setup_args['cmdclass'] = cmdclass


setuptools_args = {}
install_requires = setuptools_args['install_requires'] = [
    'notebook>=4.3.1',
    'quantlab_launcher>=0.2.1'
]

extras_require = setuptools_args['extras_require'] = {
    'test:python_version == "2.7"': ['mock'],
    'test': ['pytest', 'requests'],
    'docs': [
        'sphinx',
        'recommonmark',
        'sphinx_rtd_theme'
    ],
}


if 'setuptools' in sys.modules:
    setup_args.update(setuptools_args)

    # force entrypoints with setuptools (needed for Windows, unconditional because of wheels)
    setup_args['entry_points'] = {
        'console_scripts': [
            'jupyter-quantlab = quantlab.quantlabapp:main',
            'jupyter-quantlabextension = quantlab.quantlabextensions:main',
            'jupyter-quantlabhub = quantlab.quantlabhubapp:main'
        ]
    }
    setup_args.pop('scripts', None)

    setup_args.update(setuptools_args)

if __name__ == '__main__':
    setup(**setup_args)
