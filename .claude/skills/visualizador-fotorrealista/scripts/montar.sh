#!/bin/bash
# Monta el reel vertical 1080x1920 a 24 fps desde las secuencias de 12 fps de Blender.
set -e
F=${AXV_TRABAJO:-$PWD}
O=$F/out; V=$O/video; mkdir -p $V
FONT=/usr/share/fonts/opentype/inter/Inter-Light.otf
FONTB=/usr/share/fonts/opentype/inter/Inter-SemiBold.otf
[ -f $FONT ] || FONT=$(fc-list | grep -m1 "Inter-Regular" | cut -d: -f1)
[ -f $FONTB ] || FONTB=$FONT
TOMAS="anim_llegada anim_lateral anim_piedra anim_dron"
for t in $TOMAS; do
  ffmpeg -y -loglevel error -framerate 12 -i $O/$t/%04d.png \
    -vf "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=1080:1920:flags=lanczos,unsharp=5:5:0.55:5:5:0.0,vignette=angle=PI/5.5,noise=alls=5:allf=t" \
    -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p $V/$t.mp4
done
# duraciones
d() { ffprobe -v error -show_entries format=duration -of csv=p=0 $V/$1.mp4; }
D1=$(d anim_llegada); D2=$(d anim_lateral); D3=$(d anim_piedra); D4=$(d anim_dron)
X=0.5
O1=$(python3 -c "print($D1-$X)"); O2=$(python3 -c "print($D1+$D2-2*$X)"); O3=$(python3 -c "print($D1+$D2+$D3-3*$X)")
TOT=$(python3 -c "print($D1+$D2+$D3+$D4-3*$X)")
FIN=$(python3 -c "print($TOT-2.2)")
ffmpeg -y -loglevel error -i $V/anim_llegada.mp4 -i $V/anim_lateral.mp4 -i $V/anim_piedra.mp4 -i $V/anim_dron.mp4 -filter_complex "\
[0][1]xfade=transition=fade:duration=$X:offset=$O1[a];\
[a][2]xfade=transition=fade:duration=$X:offset=$O2[b];\
[b][3]xfade=transition=fade:duration=$X:offset=$O3[c];\
[c]drawtext=fontfile=$FONTB:text='MONTANA':fontcolor=white:fontsize=78:x=(w-text_w)/2:y=h*0.12:alpha='if(lt(t,0.4),0,if(lt(t,1.2),(t-0.4)/0.8,if(lt(t,3.2),1,if(lt(t,4.0),(4.0-t)/0.8,0))))':borderw=0:shadowcolor=black@0.35:shadowx=0:shadowy=2,\
drawtext=fontfile=$FONT:text='CASAS CAMPESTRES EN LOTES INDEPENDIENTES':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=h*0.12+100:alpha='if(lt(t,0.7),0,if(lt(t,1.5),(t-0.7)/0.8,if(lt(t,3.2),1,if(lt(t,4.0),(4.0-t)/0.8,0))))':shadowcolor=black@0.35:shadowx=0:shadowy=2,\
drawtext=fontfile=$FONT:text='Así se verá su casa terminada':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=h*0.80:alpha='if(lt(t,$FIN),0,if(lt(t,$FIN+0.8),(t-$FIN)/0.8,1))':shadowcolor=black@0.4:shadowx=0:shadowy=2,\
drawtext=fontfile=$FONTB:text='Visualización fotorrealista · Axiona':fontcolor=white@0.85:fontsize=28:x=(w-text_w)/2:y=h*0.80+70:alpha='if(lt(t,$FIN+0.3),0,if(lt(t,$FIN+1.1),(t-$FIN-0.3)/0.8,1))':shadowcolor=black@0.4:shadowx=0:shadowy=2,\
fade=t=in:st=0:d=0.5,fade=t=out:st=$(python3 -c "print($TOT-0.5)"):d=0.5[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart -r 24 $V/montana_reel_9x16.mp4
ffprobe -v error -show_entries format=duration:stream=width,height -of default=nw=1 $V/montana_reel_9x16.mp4
