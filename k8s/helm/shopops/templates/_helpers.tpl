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
