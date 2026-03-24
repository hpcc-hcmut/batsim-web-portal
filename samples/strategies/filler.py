"""
Filler scheduler wrapper for PyBatsim CLI.

PyBatsim CLI expects: module name -> CamelCase class name.
File 'filler.py' -> looks for class 'Filler'.
We alias the built-in filler_sched function as 'Filler'.
"""
from batsim.sched.algorithms.filling import filler_sched as Filler  # noqa: F401
