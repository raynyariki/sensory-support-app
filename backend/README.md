# Sensory Support API

Backend for **An Online Sensory-Support Application for Individuals with Auditory Sensitivities**.

It recognises a small set of environmental sounds from short recordings, compares them with each user's own sound profile, and keeps a private history. It is a **sensory-support and accessibility tool, not a medical device**. It does not diagnose, treat or predict any condition (including autism, hearing loss, hyperacusis or sensory processing differences), and it does not predict or prevent meltdowns.

## Stack

Python 3.13, FastAPI, SQLAlchemy 2, PostgreSQL, Librosa / NumPy / SciPy for audio, scikit-learn (Random Forest and SVM), bcrypt and JWT for authentication, pytest for tests.

## Setup (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Database.** Install PostgreSQL, open *SQL Shell (psql)* and run:

```sql
CREATE USER sensory WITH PASSWORD 'choose-a-password';
CREATE DATABASE sensory_support OWNER sensory;
```

**Settings.** Copy `.env.example` to `.env` and fill it in. Generate the secret key with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`.env` holds secrets and is excluded from Git. The tables are created automatically on first start.

**Run.**

```powershell
uvicorn app.main:app --reload
```

Interactive documentation: http://localhost:8000/docs

## Train the sound model

Download [ESC-50](https://github.com/karolpiczak/ESC-50) and unzip it to `data/ESC-50-master`, then:

```powershell
python -m ml.train --esc50 data/ESC-50-master
```

Optional: add [UrbanSound8K](https://urbansounddataset.weebly.com/urbansound8k.html) with `--urbansound8k data/UrbanSound8K` to make drilling and jackhammer detectable. Add `--cv` for a leave-one-fold-out cross-validation (slower, more stable numbers).

This writes `models/model.joblib`, `model_meta.json`, `metrics.json` and `confusion_matrix.csv`. The model file is a pickle and is not committed; only load model files you trained yourself.

## Tests

```powershell
python -m pytest -q
```

67 automated tests cover registration and login rules, token expiry and logout, throttling, profile and password changes, account deletion, sound profile and history (including that one user can never read or change another's data), analytics, audio processing, and the recognition endpoint's alert, cooldown and quiet-recording rules. They run on an in-memory database with a stand-in model, so they never touch real data. Model accuracy is measured separately by `ml.train`.

## API

Most endpoints need `Authorization: Bearer <token>`. Errors always look like `{"detail": "...", "errors": {"field": "message"}}`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create an account and log in |
| POST | `/auth/login` | Log in (`remember_me` gives a 30-day token instead of 8 hours) |
| POST | `/auth/logout` | Invalidate all tokens for the account |
| GET, PUT | `/profile` | View or edit name and email |
| PUT | `/profile/password` | Change password |
| DELETE | `/profile?confirm=true` | Delete the account and all its data |
| GET, PUT | `/settings` | Alerts on/off and alert level |
| GET, POST, PUT | `/sound-preferences` | List, add, or save the whole sound profile |
| PUT, DELETE | `/sound-preferences/{id}` | Change or remove one sound |
| GET, POST | `/sound-events` | List (filter, paginate) or add a history entry |
| GET, PATCH, DELETE | `/sound-events/{id}` | View, edit or delete one entry |
| DELETE | `/sound-events?confirm=true` | Delete all history |
| GET | `/analytics` | Counts by sound, day and response |
| POST | `/classify` | Recognise a sound in a WAV recording |
| GET | `/sounds` | The sounds the app knows, and which the loaded model can detect |
| GET | `/health` | Server, database and model status |

## Database

Three tables: `users`, `sound_preferences` (unique per user and sound), `sound_events`. The planned separate Sound Event and Trigger Diary tables are merged, because a diary entry is just a sound event the user annotated. Deleting a user deletes their rows. Constraints in the database enforce allowed values and uniqueness.

`sound_level_dbfs` is the recording level relative to the microphone maximum. It is deliberately **not** dB SPL, because phone microphones are not calibrated. `approximate_location` is a coarse place name the user types, never coordinates.

## Security and privacy

- Passwords are hashed with bcrypt and never stored or returned.
- Login returns the same message for a wrong password and an unknown email, and repeated failures are throttled (429).
- Logging out or changing the password invalidates every earlier token.
- Every query is restricted to the signed-in user; another user's record is reported as not found.
- **Raw audio is never stored.** A recording is analysed in memory and discarded; only the result is saved.
- Secrets are in `.env`, which is not committed.
- Destructive actions (delete account, delete history) require `confirm=true`.

## How sounds are recognised

1. Decode the WAV, convert to mono 22,050 Hz.
2. Trim silence, keep the loudest 5 seconds, measure the level, normalise.
3. Extract 64 features: mean and standard deviation of 20 MFCCs, spectral centroid, bandwidth, roll-off, zero-crossing rate, RMS energy, 6 spectral-contrast bands and spectral flatness.
4. A scikit-learn pipeline (scaler + classifier) returns a probability for each class.
5. A sound is "detected" only if it is not `other` and confidence is at least 0.5. Recordings quieter than -65 dBFS are not analysed.
6. The result is compared with the user's sound profile and alert settings. Entries are saved only for sounds the user rated, at most once per minute per sound.

Training and serving share one file (`app/audio.py`), so recordings are treated identically in both.

## Datasets and evaluation

Dataset classes map to the app's sounds in `app/catalogue.py`. Every other class becomes `other`, so the model can say "none of the sounds you track".

| App sound | ESC-50 class | UrbanSound8K class |
|---|---|---|
| Siren | siren | siren |
| Car horn | car_horn | car_horn |
| Dog barking | dog | dog_bark |
| Alarm | clock_alarm | none |
| Drilling | none | drilling |
| Jackhammer | none | jackhammer |

ESC-50 has no drilling or jackhammer, so those need UrbanSound8K; `GET /sounds` reports what the loaded model can actually detect. "Alarm" means alarm-clock beeps only, **not** fire or smoke alarms.

Clips are split by the datasets' own folds (train, validation, test), so clips from one original recording are never on both sides. The model type is chosen on the validation folds, then measured once on the test fold.

**Results of the ESC-50 run** (SVM chosen; test fold of 400 clips: 8 per sound, 368 other):

| Class | Precision | Recall | F1 | Test clips |
|---|---|---|---|---|
| alarm | 0.60 | 0.75 | 0.67 | 8 |
| car_horn | 0.53 | 1.00 | 0.70 | 8 |
| dog_barking | 0.57 | 0.50 | 0.53 | 8 |
| siren | 0.60 | 0.38 | 0.46 | 8 |
| other | 0.97 | 0.96 | 0.96 | 368 |

Macro precision 0.655, macro recall 0.716, macro F1 0.664. Overall accuracy was 0.932, but that figure is inflated because 92% of the test clips are `other`; macro F1 is the fairer summary. With only 8 test clips per sound, one clip moves a recall figure by 12.5 points, so treat the per-sound numbers as rough. Full results are in `models/metrics.json` and `models/confusion_matrix.csv`. Retrain and update this table if the data or settings change.

## Limitations

- Baseline classical models on a small dataset; expect misses and mislabels. Confidence is an estimate, not a certainty.
- Only WAV uploads are accepted (the website should record or convert to WAV).
- Environmental sounds in Nairobi may differ from the datasets' recordings.
- Login throttling is in memory, which suits a single server process.
- Dataset licences (ESC-50, UrbanSound8K) should be checked before any non-academic use.