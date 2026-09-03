# Changelog

0.5: Compose prepares every cross-box runtime dependency and assembles the ignored `city-tiny` preview world before Engine starts. Fresh clones need no generated world artifact.

0.4: Docker Compose builds Engine's nested local speech service, mounts its Hugging Face model store read-only, keeps port 8091 inside the Compose network, and starts Engine after both model adapters are ready. Preview checks verify the proxied Chatterbox Nano and faster-whisper identities. The loaded CPU speech process measured about 4.4 GB peak resident memory.

0.3: Docker Compose runs every preview and runtime service. Naming remains a CLI and library. The coordinator verifies all nine boxes in one pass, then checks every preview and integration surface after startup.
