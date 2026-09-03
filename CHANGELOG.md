# Changelog

0.4: Docker Compose builds Engine's nested local speech service, mounts its Hugging Face model store read-only, keeps port 8091 inside the Compose network, and starts Engine after both model adapters are ready. Preview checks verify the proxied Chatterbox Nano and faster-whisper identities. The loaded CPU speech process measures about 4.4 GB.

0.3: nine contract-defined boxes run through one Docker Compose stack. The coordinator verifies every box's tests and production build in one pass, and checks all preview and integration surfaces after startup.
