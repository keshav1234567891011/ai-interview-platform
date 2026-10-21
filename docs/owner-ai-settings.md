# Owner AI settings

The existing owner account manages `/owner/ai-settings`. All settings and credential endpoints require a currently active, authenticated owner who has completed their first password change. A maximum-permission admin is denied. Public registration, candidate profiles and delegated permissions cannot grant this capability.

## Controls

The page displays provider enabled/configured state, credential source, supported text/transcription models, fallback state, encryption readiness and last modification time. It supports saving provider/model controls, adding/replacing/removing the encrypted database key, and an explicit metadata-only connection test. No saved credential, key fragment, hash or ciphertext is returned. Inputs start empty and clear after successful replacement. The website never edits `.env`.

Supported text models are `gpt-5-mini` and `gpt-5-nano`. Supported transcription models are `gpt-4o-mini-transcribe` and `gpt-4o-transcribe`. These allowlists are server-validated. Additional models require a deliberate code/test update, not arbitrary requests supplied through the UI.

## Encryption and resolution

Migration `0010` creates one optional configuration row with an authenticated encrypted credential, safe model/enable fields and updater metadata. The API encrypts credentials with the maintained `cryptography` library's Fernet implementation. Its independent `SETTINGS_ENCRYPTION_KEY` comes only from server environment configuration. Keep it stable and privately backed up: losing/changing it makes the encrypted credential unreadable. Never print the key or put it in frontend/build arguments. No automatic replacement of an existing encryption key occurs.

For every subsequent provider operation:

1. If the provider is explicitly disabled, no AI credential is used, including the environment key.
2. Otherwise prefer a usable decrypted database credential.
3. If that credential is absent or cannot be decrypted, use a usable `OPENAI_API_KEY` from the environment.
4. With no usable credential, use existing deterministic question/evaluation behavior and browser/text transcription fallback.

Settings are resolved from the database per request; replacing/removing a key or changing a model needs no application deployment. An already running provider request may complete using the configuration with which it started. Environment or encryption-key changes require an application restart. Removing the database credential may activate the environment credential; disable the provider explicitly to prevent that.

Missing/malformed encryption configuration refuses database key writes/removal with a generic 503. An unreadable ciphertext is reported as an encryption issue, never exposed. Owners may deliberately replace unreadable ciphertext when a valid encryption key is available; operators must first consider restoring the original key from a private backup. AI disable/model controls remain available without encryption configuration so fallback can be retained.

## Connection test and audit

Test Connection makes bounded GET requests for the two selected models at the fixed OpenAI model metadata endpoint. It does not generate text, submit a transcript, send candidate data or prove billing/inference access. It returns safe enums for connected, authentication failure, rate limit, model unavailable, provider unavailable, not configured or disabled. Raw responses, request headers and exception details are suppressed. It runs only on explicit owner action; automated tests mock the entire transport.

The shared owner mutation budget applies, with an additional three connection probes per minute per owner. The existing owner row lock serializes configuration mutations; network testing occurs after releasing it. Atomic audit records identify key added/replaced/removed, provider enabled/disabled, models changed and connection tested; no credential or ciphertext is included. Provider models and endpoints are not user-controlled URLs.

References: [Fernet authenticated encryption](https://cryptography.io/en/stable/fernet/), [OpenAI model metadata retrieval](https://developers.openai.com/api/reference/resources/models/methods/retrieve), [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini), [transcription model](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe).
