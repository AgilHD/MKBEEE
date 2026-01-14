# Teachable Machine Audio Model Setup

This directory contains the Teachable Machine Audio model files for cry detection.

## Required Files

Place the following files in this directory:

- `model.json` - Model architecture and weights
- `metadata.json` - Model metadata and class labels  
- `weights.bin` - Model weights (if separate from model.json)

## How to Export from Teachable Machine

1. Go to [Teachable Machine](https://teachablemachine.withgoogle.com/)
2. Create an Audio Project
3. Train your model with audio samples (e.g., "cry", "quiet", "fuss")
4. Export the model:
   - Click "Download my model"
   - Choose "TensorFlow.js" format
   - Download the ZIP file
5. Extract the files and place them in this directory

## Model Structure

The model should be trained to classify audio into categories like:
- `cry` - Baby crying
- `quiet` - Silence or normal sounds
- `fuss` - Fussing or mild distress

## File Structure

```
public/tm-audio-model/
├── model.json          # Model architecture
├── metadata.json       # Class labels and metadata
├── weights.bin         # Model weights (if applicable)
└── README.md          # This file
```

## Integration

The AudioView component will automatically load the model from this directory when initialized.

## Notes

- Model files should be optimized for web deployment
- Consider file size limits for your hosting platform
- Test the model with sample audio before deployment
