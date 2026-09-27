REPO_ROOT := $(abspath ../..)
export PYTHONPATH := $(CURDIR)

.PHONY: setup generate-demo collect preprocess train evaluate export-model test

setup:
	pip install -e ".[test]"

generate-demo:
	python -m behavior_pipeline generate-demo

collect:
	python scripts/ingest_device_export.py --src $(REPO_ROOT)/data/behavior/incoming --dst $(REPO_ROOT)/data/behavior/raw

preprocess:
	python -m behavior_pipeline preprocess

train:
	python -m behavior_pipeline train

evaluate:
	python -m behavior_pipeline evaluate

export-model:
	python -m behavior_pipeline export-model

test:
	pytest -q
