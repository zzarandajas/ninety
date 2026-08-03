import { createContext, useContext, useEffect, useRef } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

export interface PageHeaderData {
  title?: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}

export const PageHeaderContext = createContext<Dispatch<SetStateAction<PageHeaderData | null>>>(() => {});

/**
 * Registra la cabecera de la página (título, icono, subtítulo y acciones) en el
 * layout para que se renderice en la barra superior, evitando títulos duplicados
 * dentro del contenido. Al desmontar la página, la cabecera vuelve a null.
 */
export function usePageHeader(header: PageHeaderData | null) {
  const setHeader = useContext(PageHeaderContext);
  const ref = useRef(header);
  ref.current = header;

  useEffect(() => {
    setHeader(ref.current);
    return () => setHeader(null);
  }, [setHeader]);
}
