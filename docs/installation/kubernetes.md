---
title: Self-host on Kubernetes
description: What fantasy-infra assumes about your cluster, what to replace without the original homelab, and how to deploy it.
sidebar_position: 4
---

fantasy-infra's manifests were written for one homelab cluster. This page lists what they assume, what you replace on your own cluster, and the order to bring it up in. Run the stack [locally](./local-development.mdx) first, so you know your league and cookies work.

:::info[Prerequisites]
- Kubernetes 1.27 or later (the CronJobs use `timeZone`), with a **default StorageClass** that can provision ReadWriteOnce volumes.
- `kubectl` with Kustomize (`kubectl kustomize`).
- Cluster-admin rights to install Argo CD, KEDA and External Secrets Operator.
- A Google OAuth client and a domain you can point at the cluster with TLS.
:::

## What does fantasy-infra assume?

| Dependency | What it's used for | In fantasy-infra | Without the homelab |
|---|---|---|---|
| Argo CD | Syncs `overlays/production` from Git, with prune and self-heal | The Application lives in the cluster repo, not here | Create your own Application ([below](#5-point-argo-cd-at-your-fork)), or run `kubectl apply -k overlays/production` |
| Argo CD Image Updater | Commits new image digests to the overlay | `base/argocd-image-updater/` | Optional. Remove it from `base/kustomization.yaml` and pin digests by hand, or give it a deploy key for your fork. |
| KEDA | Starts worker pods when a queue has messages | `base/browser-worker/keda-scaledjob.yaml` | Install KEDA; its RabbitMQ scaler is built in. The HTTP add-on is only for Ollama. |
| RabbitMQ | Queues between core and the worker | `base/databases/rabbitmq-deployment.yaml`, a plain Deployment with a 2 Gi volume and a definitions ConfigMap | Nothing to install; it ships in the manifests |
| Postgres | All state | `base/databases/postgres.yaml`, a StatefulSet with a 10 Gi volume | Ships in the manifests. **No backup job ships**; follow [Back up the database](/infra/databases#back-up-the-database). |
| Redis | Locks, the draft feed, notification de-duplication | `base/databases/redis-deployment.yaml`, no persistence | Ships in the manifests |
| External Secrets Operator and OpenBao | Turn OpenBao paths into Kubernetes Secrets | `overlays/production/externalsecrets.yaml`, through a ClusterSecretStore named `openbao` | Install ESO and a `ClusterSecretStore` named `openbao` for any provider it supports (Vault, OpenBao, a cloud secret manager), or rename `secretStoreRef` in the overlay |
| oauth2-proxy | Google sign-in in front of the UI and API | `base/oauth2-proxy/`, NodePort 30292 | Keep it. Point your TLS ingress or proxy at the `oauth2-proxy` Service. |
| Ingress and TLS | Public HTTPS | None: an external reverse proxy targets the NodePort, plus a Cloudflare tunnel and Tailscale ingresses | Add your own Ingress with TLS (for example ingress-nginx and cert-manager) to `oauth2-proxy:4180` |
| Container images | core, worker and UI | `ghcr.io/cvillarr23/fantasy-*`, pulled with `ghcr-pull-secret` | Pull them as they are, or build each repo's `Dockerfile` and push to your registry |
| Tempo, Loki, Prometheus, Grafana | Traces, logs, dashboards and alerts | Dashboard and alert ConfigMaps in `base/`; endpoints in each workload's `OTEL_*` env | Optional. Without Tempo, the trace exporter logs errors and the services keep running. |

## What is specific to the original homelab?

Change these in your fork before the first sync.

| Value | Where | Change to |
|---|---|---|
| Namespace `default` and `*.default.svc.cluster.local` in env values | Every workload | Keep `default`, or replace every service DNS name along with the namespace |
| `resolver 10.152.183.152` (MicroK8s CoreDNS) | `nginx.conf.template` in the fantasy-web-ui image | Your cluster DNS Service IP (`kubectl -n kube-system get svc kube-dns`). It's baked into the image, so rebuild the UI image or mount your own template over `/etc/nginx/templates/default.conf.template`. |
| Pinned UI ClusterIP `10.152.183.104` | `base/web-ui/service.yaml` | Remove `clusterIP`; it exists only for the homelab's Cloudflare tunnel |
| Tailscale ingresses | `base/web-ui/ingress.yaml`, `base/databases/rabbitmq-ingress.yaml` | Remove them, or install the Tailscale operator |
| ntfy server and UI URLs | `base/browser-worker/notify-config.yaml` | Your own ntfy server and public UI URL, or leave `fantasy/ntfy` unset and nothing is sent ([ntfy](/integrations/ntfy)) |
| `CURRENT_YEAR` and `--season 2026` | `overlays/production/configmap-env.yaml`; the weekly and actual-scores CronJob commands | The season you play |
| `America/Chicago` | Every CronJob's `timeZone` | Your time zone, if you want different local times. ESPN's deadlines don't move. |
| Image digests | `images:` in `overlays/production/kustomization.yaml` | Current digests, or your own images |

## Deploy

### 1. Fork fantasy-infra

Fork `cvillarr23/fantasy-infra` and make the changes above. Then check that it renders:

```bash
kubectl kustomize overlays/production > /dev/null
kubectl kustomize overlays/draft-day > /dev/null
```

The repo's own checks are listed in [Checks and tests](/contributing/checks).

### 2. Turn every write off for the first deploy

The production overlay is armed for live trades. The worker ScaledJob sets `TRADE_DRY_RUN=false` and `TRADE_SUBMIT_ENABLED=true`, and no workload sets `DRY_RUN`, so the lineup bot is live. Until you trust the stack, edit the ScaledJob's env in your fork:

| Variable | Set to |
|---|---|
| `DRY_RUN` | `"true"` (add it) |
| `TRADE_DRY_RUN` | `"true"` |
| `TRADE_SUBMIT_ENABLED` | `"false"` |

Leave `IDLE_EXIT_SECONDS` as the first env entry; the draft-day overlay patches it by position. fantasy-infra's `tests/test_worker_triggers.py` asserts the armed values, so update it in the same change. The full checklist is in [Run with every write disabled](./dry-run.md).

### 3. Install the platform

Install Argo CD, KEDA and External Secrets Operator, following each project's instructions. Then create a `ClusterSecretStore` named `openbao` that can read the paths in the next step.

### 4. Seed the secrets

Every Secret the workloads use comes from an ExternalSecret. Write these paths to your secret store before the first sync; a missing field fails that ExternalSecret, and the pods that need it don't start.

| Path | Properties | Becomes |
|---|---|---|
| `fantasy/postgres` | `postgres-password` | `database-credentials` |
| `fantasy/postgres-readonly` | `readonly-password` | `readonly-database-credentials` |
| `fantasy/rabbitmq` | `rabbitmq-user`, `rabbitmq-password` | `rabbitmq-credentials`, including `amqp-url` |
| `fantasy/trigger-api-key` | `trigger_api_key`, any long random string | `trigger-api-key` |
| `fantasy/espn` | `espn_s2`, `swid` | `espn-session-secrets` |
| `fantasy/deployment` | `ESPN_LEAGUE_ID`, `ESPN_TEAM_ID` | `espn-session-secrets` |
| `fantasy/espn-session-state` | `state`: the saved browser session JSON | `espn-session-state`. Optional; see [step 6](#6-bring-the-data-up). |
| `fantasy/oauth2-proxy` | `client-id`, `client-secret`, `cookie-secret` | `oauth2-proxy-credentials` |
| `fantasy/oauth2-proxy-deployment` | `authenticated-emails-list` (one email per line), `redirect-url`, `cookie-domain` | `oauth2-proxy-deployment-config` |
| `fantasy/ghcr` | `username`, `token` with `read:packages` | `ghcr-pull-secret`, in `default` and `argocd`. The template is for `ghcr.io`; edit it if your images live elsewhere. |
| `fantasy/groq`, `fantasy/gemini` | `groq_api_key`, `gemini_api_key` | LLM keys. See [LLM providers](/integrations/llm-providers). |
| `fantasy/ntfy` | `token` | `ntfy-credentials`. Optional. |
| `fantasy/argocd-image-updater-git` | `ssh-private-key`, `ssh-public-key` | The Image Updater's deploy key. Only if you keep the Image Updater. |

With OpenBao, each row is one `bao kv put secret/<path> <property>=<value> …`. Generate the oauth2-proxy cookie secret with `openssl rand -base64 32 | tr -- '+/' '-_'`. More on delivery and rotation is in [Secrets](/infra/secrets) and [Supply private deployment values](/infra/deployment#supply-private-deployment-values).

### 5. Point Argo CD at your fork

```yaml title="fantasy-infra-application.yaml"
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: fantasy-infra
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<you>/fantasy-infra.git
    targetRevision: HEAD
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated: {prune: true, selfHeal: true}
```

Apply it with `kubectl apply -f fantasy-infra-application.yaml`. For draft day, switch `path` to `overlays/draft-day`; see [Choose the overlay](/infra/deployment#choose-the-overlay).

### 6. Bring the data up

The API creates the schema when it starts. The CronJobs then ingest on their schedule ([Schedules](/infra/schedules)). Two ingestors have no schedule, so run them once, along with a first refresh, instead of waiting for the next one:

```bash
kubectl exec deploy/fantasy-core-pipeline -- python -m src.ingestion.sync_players --force
kubectl exec deploy/fantasy-core-pipeline -- python -m src.ingestion.sync_id_crosswalk
kubectl create job --from=cronjob/fantasy-weekly-ingestor first-ingest
kubectl exec deploy/fantasy-core-pipeline -- python -m src.ingestion.sync_skill_position_crosswalk --season <season>
kubectl create job --from=cronjob/fantasy-draft-prep-refresher first-refresh
```

For the draft room and trade builder, save a browser session with the remote login Job; see [Refreshing the login remotely](/worker/espn/session-and-auth#refreshing-the-login-remotely). It writes `fantasy/espn-session-state` for you.

### 7. Verify

| Check | Expect |
|---|---|
| `kubectl get externalsecrets` | Every row `SecretSynced` |
| `kubectl get pods` | The API, UI, oauth2-proxy, Postgres, Redis and RabbitMQ `Running` |
| `kubectl port-forward svc/fantasy-core-pipeline 8000:8000`, then `curl localhost:8000/v1/health` | `"database":"connected","broker":"connected"` |
| `kubectl create job --from=cronjob/espn-session-healthcheck espn-check` | The Job completes. A failure means the cookies or IDs are wrong. |
| Your public URL | Google sign-in, then the UI. Save your league on **Settings**. |

## Troubleshooting

| Symptom | Fix |
|---|---|
| An ExternalSecret shows `SecretSyncedError` | A path or property from step 4 is missing, or the store's policy can't read it. |
| Pods stay `ImagePullBackOff` | `ghcr-pull-secret` can't read the images. Check `fantasy/ghcr`. |
| The UI loads, but every `/v1` call fails with 502 | The UI's nginx can't resolve the API. Fix the `resolver` address. |
| Google sign-in loops or rejects you | `redirect-url` must match the OAuth client exactly, `cookie-domain` must match your host, and your email must be on the list. |
| Worker pods never start | KEDA isn't installed, or `rabbitmq-trigger-auth` can't read `rabbitmq-credentials`. |

Day-two runbooks, such as expired sessions, stuck queues and rollbacks, are in [Operations](/infra/operations).
