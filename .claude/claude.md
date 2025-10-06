# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
The Investigative Workload Application (IWA) is a Case Assignment Model (CAM) optimization system that distributes investigative cases across multiple organizations using OR-Tools optimization. It runs as a Flask web application with offline deployment capabilities.

## Development Commands

### Running the Application
```bash
# Development server
python app.py

# Run CAM optimization with performance comparison
python runcam_enhanced.py         # Default: compares original vs enhanced
python runcam_enhanced.py compare  # Explicit comparison mode
python runcam_enhanced.py enhanced # Run only enhanced parallel version
python runcam_enhanced.py original # Run only original version

# Standard CAM execution with diagnostics
python runcam_standard.py
```

### Testing
```bash
# Run all tests
make test

# Run specific test categories
make test-unit       # Unit tests only
make test-integration # Integration tests
make test-e2e        # End-to-end tests
make test-performance # Performance benchmarks

# Run tests with coverage
make coverage

# Run tests in parallel
make test-parallel

# Run only failed tests from last run
make test-failed

# Run single test file
pytest app/pipeline/test_pipeline.py -v
```

### Linting and Formatting
```bash
# Run linting checks
make lint  # Runs flake8 and mypy

# Format code with black
make format

# Clean generated files
make clean
```

### Installation
```bash
# For users WITH Python already installed
install.bat              # Install for Python 3.11 (default)
install.bat 313          # Install for Python 3.13
install.bat both         # Install for both versions
install.bat offline      # Offline installation from pre-downloaded packages
install.bat download     # Download packages for offline use

# For users WITHOUT Python (no admin rights required)
install_pyenv.bat        # Installs pyenv-win + Python 3.11.9 + creates venv
```

### Build and Deployment
```bash
# Build executable (Windows)
build_app.bat            # Main build script with system specs logging
                         # Outputs: Investigative Workload Application.exe (project root)
                         #          _internal/ folder (dependencies)

# Run the built executable
RUN_EXE.bat              # Launcher with pre-flight checks
# Or double-click: Investigative Workload Application.exe

# Build structure:
# build Version 1.6.2/
# ├── Investigative Workload Application.exe  ← Runs from here
# ├── _internal/                              ← Dependencies
# ├── app/                                    ← Data files (not bundled)
# ├── templates/                              ← Flask templates
# └── static/                                 ← Static assets
```

## Architecture

### Core Components

#### CAM Pipeline (`app/pipeline/`)
The modular pipeline architecture consists of:
- **DataLoader**: Handles data ingestion from CSV and Excel files
- **DataProcessor**: Processes and validates case data, handles constraints
- **CAMSolver**: Core optimization engine using OR-Tools
- **ResultEvaluator**: Validates and evaluates optimization results
- **ReportGenerator**: Creates Excel reports with assignment results
- **PerformanceMonitor**: Tracks performance metrics and bottlenecks
- **Orchestrator**: Coordinates the entire pipeline execution

#### CAM Scripts (`app/CAM_Scripts/`)
- **CAM.py**: Original CAM implementation
- **CAM_optimized.py**: Performance-optimized version with parallel processing
- **input_transformer.py**: Transforms input data for optimization
- **Model_Reports.py**: Generates detailed assignment reports

#### Data Flow
1. **Input**: IWA_Data CSV files (~30MB, 4,953 cases) + FWM Excel files (capacity data)
2. **Processing**: Data validation, constraint building, matrix operations
3. **Optimization**: OR-Tools solver with multiple constraint types
4. **Caching**: Matrix cache (73MB) and solution cache for performance
5. **Output**: Excel reports with case assignments and metrics

### Performance Optimizations
- **Parallel Processing**: Enhanced parallel processor (`enhanced_parallel_processor.py`)
- **Vectorized Operations**: NumPy-based matrix operations
- **Caching Strategy**: Pre-computed matrices and solution caching
- **Sparse Matrices**: Memory-efficient sparse matrix operations

### Key Files and Directories
- `app/IWA_Files/CommonFiles/`: Core data files and caches
- `app/IWA_Files/DutyStations/`: Organization capacity Excel files
- `app/IWA_Files/OutputFiles/`: Generated assignment reports
- `performance_logs/`: JSON performance metrics from optimization runs
- `constraint_config.json`: Optimization constraint configuration

## Important Context

### Organizations Supported
1. **IF01** (Federal) - Priority 1, 90% capacity limit
2. **IC05** (Keypoint) - Priority 2
3. **IC07** (CACI) - Priority 3
4. **IC17** (SCIS) - Priority 4
5. **IC16** (CSRA) - Additional organization

### Common Issues
- **Zero Capacity Warning**: Check FWM Excel files for valid EMH_ONHAND values
- **Cache Issues**: Run `python clear_cam_cache.py` to reset
- **Memory Usage**: Monitor with `cli_performance_tracker.py`

### Environment
- Python 3.11.9 (development) / Python 3.13 (production executable)
- Flask web framework with Bootstrap 3.3.7
- OR-Tools optimization library
- Offline deployment support with local static assets

## Git Commit Guidelines
- **NO Claude branding**: Do not add Claude Code branding, co-author tags, or generated-by comments to commit messages
- Keep commit messages concise and focused on the actual changes
- Follow conventional commit format when appropriate (e.g., `feat:`, `fix:`, `refactor:`)