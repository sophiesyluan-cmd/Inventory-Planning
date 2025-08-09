'use client';
export default function DataTable({rows, columns}:{rows:any[]; columns:string[]}){
  if (!rows?.length) return <div className="text-sm text-gray-500">No data</div>;
  return (
    <div className="overflow-auto border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-gray-50">
          <tr>{columns.map(c=> <th key={c} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i)=> (
            <tr key={i} className="odd:bg-white even:bg-gray-50">
              {columns.map(c=> <td key={c} className="px-3 py-2 align-top whitespace-pre-wrap">{String(r[c] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
