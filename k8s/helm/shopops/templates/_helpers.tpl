{{/* Labels added to every object this chart creates. */}}
{{- define "shopops.labels" -}}
app.kubernetes.io/part-of: shopops
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}

{{/* "repository:tag" for an image entry. */}}
{{- define "shopops.image" -}}
{{ printf "%s:%s" .repository .tag }}
{{- end }}

{{/* Labels for pod templates of the database and web pods. They leave out the chart
     and app version on purpose: a label change in a pod template restarts the pods, and
     a new chart version should not restart the database. */}}
{{- define "shopops.podLabels" -}}
app.kubernetes.io/part-of: shopops
{{- end }}

{{/* Container settings shared by the backup and restore-test jobs: the same Postgres
     image as the database (so pg_dump always matches the server version), connection
     settings from environment variables, and a locked-down security context. */}}
{{- define "shopops.pgClientContainer" -}}
image: {{ include "shopops.image" .Values.images.db }}
imagePullPolicy: {{ .Values.images.pullPolicy }}
command: ["/bin/sh", "-c"]
env:
  - name: PGHOST
    value: db
  - name: PGUSER
    value: {{ .Values.db.user | quote }}
  - name: PGDATABASE
    value: {{ .Values.db.name | quote }}
  - name: PGPASSWORD
    valueFrom:
      secretKeyRef:
        name: {{ .Values.db.existingSecret }}
        key: {{ .Values.db.passwordKey }}
  - name: HOME
    value: /tmp
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
resources:
  {{- toYaml .Values.backup.resources | nindent 2 }}
volumeMounts:
  - name: backups
    mountPath: /backups
  - name: tmp
    mountPath: /tmp
{{- end }}

{{/* Pod settings shared by the backup and restore-test jobs. uid 70 is the postgres user
     of the Alpine Postgres image, so the jobs never run as root. */}}
{{- define "shopops.pgClientPod" -}}
restartPolicy: Never
securityContext:
  runAsNonRoot: true
  runAsUser: 70
  runAsGroup: 70
  fsGroup: 70
  seccompProfile:
    type: RuntimeDefault
volumes:
  - name: backups
    persistentVolumeClaim:
      claimName: db-backups
  - name: tmp
    emptyDir: {}
{{- end }}

{{/* One Ingress rule: every path goes to the web service (Nginx), which serves the UI and
     proxies /api to the API. Shared by the HTTPS Ingress and the HTTP redirect Ingress. */}}
{{- define "shopops.ingressRule" -}}
- {{- with .Values.ingress.host }}
  host: {{ . | quote }}
  {{- end }}
  http:
    paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              number: 8080
{{- end }}
