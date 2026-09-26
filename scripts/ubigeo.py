# -*- coding: utf-8 -*-
"""
Genera el ubigeo del Perú (departamento → provincia → distrito, códigos INEI)
que usan el Libro de Reclamaciones de las webs y la validación del portal.

Fuentes, fijadas a un commit para que el resultado sea reproducible:

  A. Conjunto de distritos y códigos: INEI, «Directorio Nacional de
     Municipalidades Provinciales y Distritales», abril 2026
     (leandrofrancisco03/Ubigeo-Peru-2026). Nombres en mayúsculas.
  B. Nombres con tildes y mayúsculas correctas: INEI, «Directorio Nacional
     de … Municipalidades … 2025» (MichaelSuarez0/ubigeos_peru).

Se toma el conjunto de A y la ortografía de B, comprobando código a código
que ambas nombren lo mismo. Correcciones aplicadas:
  · A arrastra marcas de nota al pie de la tabla del INEI («PION 2/»).
  · B escribe en mayúscula los conectores («Magdalena Del Mar»).
  · B nombra una fila de la provincia 0613 como «Ninabamba» (es un distrito;
    la provincia es Santa Cruz): los nombres de provincia salen de A.
  · Santa Rosa de Loreto (160405, Ley 32403 de 2025) no está en B.

Uso:  python scripts/ubigeo.py   (escribe src/lib/ubigeo-peru.json y la
copia pública para cada web indicada en DESTINOS).
"""
import csv
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request

A = 'https://raw.githubusercontent.com/leandrofrancisco03/Ubigeo-Peru-2026/7b73309b51cfb9bcc025fde6e172bf7707310b9f/csv/'
B = 'https://raw.githubusercontent.com/MichaelSuarez0/ubigeos_peru/7943c8e3e8f862999b99732ed9493ec35abac23a/databases/ubigeo_inei_2025.csv'

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'src', 'lib', 'ubigeo-peru.json')
# Copias públicas para las webs (se cargan solo en el Libro de Reclamaciones).
DESTINOS = [
    os.path.join(RAIZ, '..', '..', 'web LP', 'public', 'data', 'ubigeo-peru.json'),
    os.path.join(RAIZ, '..', '..', 'Woli Web', 'public', 'data', 'ubigeo-peru.json'),
    os.path.join(RAIZ, '..', '..', 'QMEDICAL', 'qmedical-web', 'public', 'data', 'ubigeo-peru.json'),
]

# Distritos que B no tiene todavía: nombre con su ortografía oficial.
NUEVOS = {'160405': 'Santa Rosa de Loreto'}  # Ley 32403 (2025)

# Totales esperados según el directorio del INEI de 2026.
ESPERADO = {'departamentos': 25, 'provincias': 196, 'distritos': 1892}


def bajar(url: str) -> str:
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read().decode('utf-8-sig')


def filas(texto: str, sep=','):
    return list(csv.DictReader(io.StringIO(texto), delimiter=sep))


def clave(s: str) -> str:
    """Para comparar nombres: sin tildes, sin notas, en mayúsculas (la Ñ se conserva)."""
    s = re.sub(r'\s*\d+/\s*$', '', s.strip())
    s = unicodedata.normalize('NFD', s.upper())
    s = s.replace('Ñ', 'Ñ')
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def conectores(nombre: str) -> str:
    """«Magdalena Del Mar» → «Magdalena del Mar». El primer término y «de El»
    (parte del nombre propio, como San Miguel de El Faique) no se tocan."""
    palabras = nombre.split(' ')
    for i in range(1, len(palabras)):
        p = palabras[i]
        if p in ('Del', 'De', 'Y'):
            palabras[i] = p.lower()
        elif p in ('La', 'Las', 'Los') and palabras[i - 1].lower() == 'de':
            palabras[i] = p.lower()
    return ' '.join(palabras)


def main():
    dep_a = {r['id']: r['name'] for r in filas(bajar(A + 'ubigeo_peru_2026_departamentos.csv'))}
    prov_a = {r['id']: r['name'] for r in filas(bajar(A + 'ubigeo_peru_2026_provincias.csv'))}
    dis_a = {r['id']: r['name'] for r in filas(bajar(A + 'ubigeo_peru_2026_distritos.csv'))}
    b = {r['ubigeo']: r for r in filas(bajar(B), ';')}

    errores = []

    # Ortografía de departamentos y provincias: el nombre de B cuya clave
    # coincide con el de A (así se descarta la fila «Ninabamba» de 0613).
    def ortografia(codigo: str, oficial: str, campo: str, largo: int) -> str:
        candidatos = {r[campo] for u, r in b.items() if u[:largo] == codigo and clave(r[campo]) == clave(oficial)}
        if len(candidatos) != 1:
            errores.append(f'{campo} {codigo} «{oficial}»: {candidatos or "sin coincidencia"}')
            return oficial.title()
        return conectores(candidatos.pop())

    departamentos = {c: ortografia(c, n, 'departamento', 2) for c, n in dep_a.items()}
    provincias = {c: ortografia(c, n, 'provincia', 4) for c, n in prov_a.items()}

    distritos = {}
    for codigo, oficial in dis_a.items():
        if codigo in b:
            nombre = b[codigo]['distrito']
            if clave(nombre) != clave(oficial):
                errores.append(f'distrito {codigo}: A «{oficial}» ≠ B «{nombre}»')
            distritos[codigo] = conectores(nombre.strip())
        elif codigo in NUEVOS:
            if clave(NUEVOS[codigo]) != clave(oficial):
                errores.append(f'distrito nuevo {codigo}: «{NUEVOS[codigo]}» ≠ «{oficial}»')
            distritos[codigo] = NUEVOS[codigo]
        else:
            errores.append(f'distrito {codigo} «{oficial}» sin ortografía en B ni en NUEVOS')

    # ---------------------------------------------------------- comprobaciones
    for c in distritos:
        if not re.fullmatch(r'\d{6}', c):
            errores.append(f'código de distrito mal formado: {c}')
        if c[:4] not in provincias:
            errores.append(f'distrito {c} sin provincia')
    for c in provincias:
        if c[:2] not in departamentos:
            errores.append(f'provincia {c} sin departamento')
        if not any(d[:4] == c for d in distritos):
            errores.append(f'provincia {c} sin distritos')
    for nivel, datos in (('departamentos', departamentos), ('provincias', provincias), ('distritos', distritos)):
        if len(datos) != ESPERADO[nivel]:
            errores.append(f'{nivel}: {len(datos)}, se esperaban {ESPERADO[nivel]}')
        for c, n in datos.items():
            if n != n.strip() or '  ' in n or re.search(r'[\d/()*]', n):
                errores.append(f'nombre sospechoso {c}: «{n}»')
    # Nombres de distrito repetidos dentro de una misma provincia
    vistos = {}
    for c, n in distritos.items():
        k = (c[:4], clave(n))
        if k in vistos:
            errores.append(f'distrito repetido en {c[:4]}: {vistos[k]} y {c} «{n}»')
        vistos[k] = c

    if errores:
        print('ERRORES:')
        for e in errores:
            print('  ·', e)
        sys.exit(1)

    # ---------------------------------------------------------- salida compacta
    # [[cod_dep, nombre, [[cod_prov, nombre, [[cod_dist, nombre], …]], …]], …]
    orden = lambda d: sorted(d.items(), key=lambda kv: clave(kv[1]))
    arbol = [
        [cd, nd, [
            [cp, np, [[cx, nx] for cx, nx in orden({k: v for k, v in distritos.items() if k[:4] == cp})]]
            for cp, np in orden({k: v for k, v in provincias.items() if k[:2] == cd})
        ]]
        for cd, nd in orden(departamentos)
    ]
    datos = {
        'fuente': 'INEI · Directorio Nacional de Municipalidades Provinciales y Distritales 2026',
        'totales': {k: len(v) for k, v in (('departamentos', departamentos), ('provincias', provincias), ('distritos', distritos))},
        'd': arbol,
    }
    texto = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    for ruta in [SALIDA, *DESTINOS]:
        ruta = os.path.normpath(ruta)
        if not os.path.isdir(os.path.dirname(ruta)):
            os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
            f.write(texto)
        print(f'✓ {ruta} ({len(texto.encode()) / 1024:.1f} KB)')
    print(f"  {datos['totales']}")


if __name__ == '__main__':
    main()
