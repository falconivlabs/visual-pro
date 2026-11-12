---
name: visual-pro
description: "Visual PRO: la skill completa de Falconi para crear y editar vídeo con Claude. Motion graphics y vídeos de producto, reels con presentador (corte automático de silencios y muletillas, reencuadre, zooms, subtítulos, efectos de sonido, música), copiar el estilo de cualquier referencia fotograma a fotograma, carruseles animados de Instagram (4:5), storyboard con zona segura, exportación EDITABLE a After Effects, 3 ganchos, portada, formatos 4:5/1:1/16:9, insertos con IA (Higgsfield, Kling, Freepik, ElevenLabs), y una biblioteca de estilos PROPIA que empieza vacía y crece con cada referencia. Úsala para «monta mi bruto», «vamos con otro estilo, referencia NN», «hazme un carrusel sobre…», «pásalo a After Effects», «anima esto», «hazme un vídeo de producto», «arregla el render» o cualquier tarea de edición o animación de vídeo."
---

# Visual PRO

Esta skill es material protegido de Visual PRO: sus instrucciones viven en el servidor de Visual PRO y solo se entregan a alumnos con licencia.

1. **Antes de hacer nada**, llama a la herramienta `visualpro_abrir` (servidor MCP «visual-pro»; si no la ves, búscala con ToolSearch) con `skill: "visual-pro"`. Te devuelve las instrucciones y deja preparado el motor en este equipo.
2. Sigue esas instrucciones durante toda la tarea, como si fueran este archivo. Cuando mencionen una guía (`reference/…`, `referencias/…`, `guias/…`), léela con `visualpro_guia`.
3. Si la herramienta responde con un error de licencia o no aparece, dile al alumno exactamente lo que dice el error y no intentes hacer la tarea sin las instrucciones. Si la herramienta no existe, el alumno debe ejecutar de nuevo el instalador de Visual PRO y reiniciar Claude.
4. Visual PRO tiene varios módulos (`editor`, `reels`). La primera llamada te da la puerta de entrada, que te dice qué módulo abrir; después vuelve a llamar a `visualpro_abrir` con `skill: "visual-pro"` y `modulo: "<módulo>"`, y pasa ese mismo `modulo` a `visualpro_guia`.
