import 'react-quill-new/dist/quill.snow.css';
import ReactQuill from 'react-quill-new';
import { useRef } from 'react';

const MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['clean'],
  ],
};

export interface RichTextEditorProps {
  id?: string;
  value?: string;
  onChange?: (html: string) => void;
  onBlur?: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({ id, value, onChange, onBlur, placeholder, disabled }: RichTextEditorProps) {
  const valueRef = useRef(value ?? '');
  valueRef.current = value ?? '';

  return (
    <ReactQuill
      id={id}
      theme="snow"
      value={value ?? ''}
      onChange={(html) => onChange?.(html)}
      onBlur={() => onBlur?.(valueRef.current)}
      readOnly={disabled}
      placeholder={placeholder}
      modules={MODULES}
    />
  );
}
