# OBSOLETE — do not deploy from this file.
# It only shipped the Python app and broke sample seeding + the React UI.
# Use the repository-root Dockerfile instead (see docs/DEPLOY.md).
FROM alpine:3.20
RUN printf '%s\n' \
  'ERROR: backend/Dockerfile is obsolete.' \
  'Build from the repo root: docker build -f Dockerfile .' \
  'See docs/DEPLOY.md.' \
  >&2 && exit 1
