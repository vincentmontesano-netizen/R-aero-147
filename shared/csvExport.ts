/** Semicolon-delimited text export for spreadsheet viewing.
 * Quote all fields, escape embedded quotes and mark formula-like values as text.
 * CSV has no universal spreadsheet type system; re-saving can remove text markers.
 */
export function spreadsheetCsv(rows:readonly (readonly (string|number|boolean|null|undefined)[])[]):string{
  const cell=(value:string|number|boolean|null|undefined)=>{
    let text=value==null?'':String(value);
    const formula=/^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069]*[=+\-@\uff1d\uff0b\uff0d\uff20]/.test(text);
    if(formula||/^[\t\r\n]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
