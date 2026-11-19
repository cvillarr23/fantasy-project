---
title: Self-host on Kubernetes
description: Install the fantasy platform on your own cluster with the Helm chart, with every write to ESPN off until you turn it on.
sidebar_position: 4
---

fantasy-infra publishes a Helm chart, `oci://ghcr.io/cvillarr23/charts/fantasy`. It installs everything into one namespace:
- the API and the [job launcher](/overview/job-launcher), with its catalog;
- the KEDA-scaled browser worker;
- the UI behind Google sign-in;
- Postgres, Redis and RabbitMQ.

Run the stack [locally](./local-development.mdx) first, so you know your league and cookies work. The chart's own reference, covering every value and Secret plus a short Helm primer, is the [chart README](https://github.com/cvillarr23/fantasy-infra/blob/main/charts/fantasy/README.md).

:::info[Prerequisites]
- Kubernetes 1.27 or later, with a **default StorageClass** that can provision ReadWriteOnce volumes.
- [Helm](https://helm.sh/docs/intro/install/) 3.8 or later, and `kubectl`.
- Cluster-admin rights to install KEDA.
- A Google OAuth client and a domain you can point at the cluster with TLS. You don't need either for a trial over `kubectl port-forward`.
:::

## What does the chart need from your cluster?

| Dependency | What it's used for | With the chart |
|---|---|---|
| KEDA | Starts worker pods when a queue has messages | Install it first ([step 1](#1-install-keda)). Its RabbitMQ scaler is built in. |
| Postgres, Redis, RabbitMQ | All state, locks and the draft feed, and the queues between core and the worker | Ship in the chart. Point `postgres.host` or `redis.host` at your own instead if you like. **No backup job ships**; follow [Back up the database](/infra/databases#back-up-the-database). |
| Secrets | Database, broker, ESPN, OAuth and LLM credentials | Create them with `kubectl` ([step 2](#2-create-the-secrets)), or let External Secrets Operator fill them from your store with `secrets.provider: externalSecrets`. |
| oauth2-proxy | Google sign-in in front of the UI and API | Ships in the chart |
| Ingress and TLS | Public HTTPS | `ingress.enabled: true` creates an Ingress to oauth2-proxy for your controller, for example ingress-nginx with cert-manager. |
| Container images | core, worker and UI | Public on `ghcr.io/cvillarr23/fantasy-*`, tracking `latest`. Pin `images.*.digest` for repeatable installs. |
| Tempo, Grafana, ntfy | Traces, dashboards and alerts, phone pushes | Optional, and off by default: `otel.*`, `telemetry.*`, `notify.*` |

Argo CD isn't required. To run the chart with GitOps, see [Deploy with Argo CD](#deploy-with-argo-cd).

## Deploy

The examples install into a namespace called `fantasy`.

### 1. Install KEDA

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda --namespace keda --create-namespace
```

### 2. Create the Secrets

The workloads, and the jobs the launcher starts, read these Secrets by name. A missing required Secret stops the pods that need it from starting.

```bash
kubectl create namespace fantasy
NS=fantasy
DB_PASSWORD=$(openssl rand -hex 24)
MQ_PASSWORD=$(openssl rand -hex 24)

kubectl -n $NS create secret generic database-credentials \
  --from-literal=postgres-password="$DB_PASSWORD"
kubectl -n $NS create secret generic rabbitmq-credentials \
  --from-literal=rabbitmq-user=fantasy \
  --from-literal=rabbitmq-password="$MQ_PASSWORD" \
  --from-literal=amqp-url="amqp://fantasy:$MQ_PASSWORD@fantasy-broker.$NS.svc.cluster.local:5672/%2f"
kubectl -n $NS create secret generic trigger-api-key \
  --from-literal=trigger-api-key="$(openssl rand -hex 32)"
kubectl -n $NS create secret generic espn-session-secrets \
  --from-literal=espn_s2='<espn_s2 cookie>' --from-literal=swid='<SWID cookie>' \
  --from-literal=ESPN_LEAGUE_ID='<league id>' --from-literal=ESPN_TEAM_ID='<team id>'
kubectl -n $NS create secret generic groq-api-key --from-literal=groq_api_key='<key>'
kubectl -n $NS create secret generic gemini-api-key --from-literal=gemini_api_key='<key>'
kubectl -n $NS create secret generic oauth2-proxy-credentials \
  --from-literal=client-id='<Google client id>' --from-literal=client-secret='<Google client secret>' \
  --from-literal=cookie-secret="$(openssl rand -base64 32 | tr -- '+/' '-_')"
kubectl -n $NS create secret generic oauth2-proxy-deployment-config \
  --from-literal=authenticated-emails-list='operator@example.com' \
  --from-literal=redirect-url='https://draft.example.com/oauth2/callback' \
  --from-literal=cookie-domain='draft.example.com'
```

The `%2f` in `amqp-url` is the default vhost `/`. A bare trailing `/` makes clients ask for an empty vhost, and RabbitMQ refuses the connection. For the LLM keys, see [LLM providers](/integrations/llm-providers). A placeholder key lets the pods start, but the LLM jobs fail until it's real.

Two Secrets are optional:
- `espn-session-state` (key `state.json`; see [step 5](#5-bring-the-data-up))
- `ntfy-credentials` (key `NTFY_TOKEN`; see [ntfy](/integrations/ntfy))

Keep the values out of your shell history and logs. More on delivery and rotation is in [Secrets](/infra/secrets).

To use External Secrets Operator, skip this step. Set `secrets.provider: externalSecrets`, a `storeRef`, and a store path per Secret. The chart README lists the properties each path needs.

### 3. Write your values

Every write to ESPN starts off: `DRY_RUN=true` for every bot, and trade submission is disabled on the queue worker. The full checklist is in [Run with every write disabled](./dry-run.md).

```yaml title="my-values.yaml"
league:
  currentYear: "2026"

ingress:
  enabled: true
  className: nginx
  host: draft.example.com
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
  tls:
    - secretName: fantasy-tls
      hosts: [draft.example.com]
```

To change the job schedules or their `America/Chicago` time zone:
1. Copy the catalog from fantasy-infra's `charts/fantasy/files/catalog.yaml` and edit it.
2. Pass your copy with `--set-file launcher.catalog=my-catalog.yaml`.

The format is in [Schedules](/infra/schedules) and the [job launcher](/overview/job-launcher) overview.

Register `https://draft.example.com/oauth2/callback` with your Google OAuth client, so it matches `redirect-url` exactly.

### 4. Install

```bash
helm install fantasy oci://ghcr.io/cvillarr23/charts/fantasy \
  --namespace fantasy -f my-values.yaml
kubectl -n fantasy get pods -w
```

To review the manifests first, render them with `helm template fantasy oci://ghcr.io/cvillarr23/charts/fantasy -n fantasy -f my-values.yaml`, which changes nothing. Make later changes with `helm upgrade` and the same arguments. Resource names are fixed, so install one release per namespace.

### 5. Bring the data up

The API creates the schema when it starts. After that, the launcher runs the ingestion jobs on their schedule ([Schedules](/infra/schedules)).

Two ingestors have no schedule, so run them once now. Also run a first league ingest and refresh now, instead of waiting for the next one:

```bash
alias core='kubectl -n fantasy exec deploy/fantasy-core-pipeline --'
core python -m src.ingestion.sync_players --force
core python -m src.ingestion.sync_id_crosswalk
core python -m src.cli jobs run sync-league
core python -m src.cli jobs run metrics-extractor
core python -m src.ingestion.sync_skill_position_crosswalk --season <season>
core python -m src.cli jobs run projections-refresh
```

Each `jobs run` returns once the run is queued, and prints its run id. Wait until `python -m src.cli jobs status <run_id>` shows `success` before the next command.

For the draft room and the trade builder, save a browser session with the remote login Job; see [Refreshing the login remotely](/worker/espn/session-and-auth#refreshing-the-login-remotely). Store the result in the `espn-session-state` Secret.

### 6. Verify

| Check | Expect |
|---|---|
| `kubectl -n fantasy get pods` | The API, launcher, UI, oauth2-proxy, Postgres, Redis and RabbitMQ `Running` and ready |
| `kubectl -n fantasy port-forward svc/fantasy-core-pipeline 8000:8000`, then `curl localhost:8000/v1/health` | `"database":"connected","broker":"connected"` |
| `core python -m src.cli jobs run espn-session-healthcheck`, then `jobs status <run_id>` | The run ends `success`. A failure means the cookies or IDs are wrong. |
| Your public URL | Google sign-in, then the UI. Save your league on **Settings**. |

Once you trust the results, turn writes on and run `helm upgrade`:
- Set `league.dryRun: null` to turn on the bots' writes.
- For live trades too, also set `worker.tradeDryRun: "false"` and `worker.tradeSubmitEnabled: "true"`.

## Deploy with Argo CD

Point an Application at a fork of fantasy-infra and keep your values file in the fork. Argo CD renders the chart with `helm template` and applies the result itself. That means `helm list` shows nothing, and sync history and rollback belong to Argo CD.

```yaml title="fantasy-application.yaml"
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: fantasy
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<you>/fantasy-infra.git
    targetRevision: HEAD
    path: charts/fantasy
    helm:
      valueFiles: [my-values.yaml]
  destination:
    server: https://kubernetes.default.svc
    namespace: fantasy
  syncPolicy:
    automated: {prune: true, selfHeal: true}
```

With this setup, the Secrets from [step 2](#2-create-the-secrets) must exist before the first sync. The original homelab's own values are `values-production.yaml` and `values-draft-day.yaml`, in the same directory.

## Known limits

| Limit | Effect | Workaround |
|---|---|---|
| The fantasy-web-ui image hardcodes the homelab's DNS resolver (`resolver 10.152.183.152` in `nginx.conf.template`) | The UI loads, but every `/v1` call fails with 502 | Rebuild the UI image with your cluster DNS Service IP (`kubectl -n kube-system get svc kube-dns`) |
| Pods the launcher starts don't get `K8S_NAMESPACE` or `CORE_PIPELINE_URL` | Outside the `default` namespace, `stale-draft-job-sweeper` fails with a 403, and the trade bots can't reach the core API | Install into `default` if you need them now |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `helm install` fails with `additional properties '…' not allowed` | A values key is misspelled or unknown. The chart README lists the valid ones. |
| A pod is stuck in `CreateContainerConfigError` | A required Secret or key from [step 2](#2-create-the-secrets) is missing. `kubectl describe pod` names it. |
| RabbitMQ never gets ready | The broker's startup probe checks `rabbitmq-user` and `rabbitmq-password`. Recreate `rabbitmq-credentials`, with the same user and password in `amqp-url`. |
| The UI loads, but every `/v1` call fails with 502 | The UI's nginx can't resolve the API. See [Known limits](#known-limits). |
| Google sign-in loops or rejects you | `redirect-url` must match the OAuth client exactly, `cookie-domain` must match your host, and your email must be on the list. |
| Worker pods never start | KEDA isn't installed, or `rabbitmq-trigger-auth` can't read `amqp-url` from `rabbitmq-credentials`. |

Day-two runbooks, such as expired sessions, stuck queues and rollbacks, are in [Operations](/infra/operations).
