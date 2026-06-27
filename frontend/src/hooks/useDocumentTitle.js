import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} | LogHawk`
  }, [title])
}

export default useDocumentTitle
