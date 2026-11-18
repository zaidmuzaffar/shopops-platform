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
