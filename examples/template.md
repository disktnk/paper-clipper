---
tags: 
citekey: "{{citekey}}"
dateread: '{{importDate | format("YYYY-MM-DD")}}'
read: false
---
# {{title}}
## Note


# Citation
{{bibliography.slice(4)}}
# Related
{%for relation in relations | selectattr("citekey") %} [[@{{relation.citekey}}]]{% if not loop.last %}, {% endif%} {% endfor %}

>[!Info]
{%- for type, creators in creators | groupby("creatorType") -%}
{%- if type == "author" %}
{%- set shownCount = 10 if creators | length > 10 else creators | length %}
> **Author**:
{%- for creator in creators -%}
{%- if loop.index0 < 10 -%}
{%- if creator.name %} {{creator.name}}{%- else %} {{creator.firstName}} {{creator.lastName}}{%- endif -%}
{%- if loop.index0 + 1 < shownCount -%}
, 
{%- endif -%}
{%- endif -%}
{%- endfor %}
{%- if creators | length > 10 %}, and more{%- endif %}
{%- else %}
{%- for creator in creators -%}
> **{{type | capitalize}}**::
{%- if creator.name %} {{creator.name}}  
{%- else %} {{creator.lastName}}, {{creator.firstName}}{%- endif %}  {% endfor -%}
{%- endif %}
{%- endfor %}
> **Title**: {{title}}
> **Year**: {{date | format("YYYY")}}
> **Citekey**: {{citekey}} {%- if itemType %}
> **itemType**: {{itemType}}{%- endif %}{%- if itemType == "journalArticle" %}
> **Journal**: *{{publicationTitle}}* {%- endif %}{%- if volume %}
> **Volume**: {{volume}} {%- endif %}{%- if issue %}
> **Issue**: {{issue}}{%- endif %}

> [!Abstract]
{%- if abstractNote %}
> {{abstractNote}}
{%- endif %}

> [!Data]
> **Link**
> {%- if url %}[{{title}}]({{url}}){%- endif %}
