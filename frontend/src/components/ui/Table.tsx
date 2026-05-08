import type { ReactNode } from 'react';

interface TableProps {
  headers: string[];
  children: ReactNode;
}

function Table({ headers, children }: TableProps) {
  return (
    <div className="bg-dark-card/60 backdrop-blur-sm border border-dark-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-dark-border bg-surface/50">
            {headers.map((header, index) => (
              <th 
                key={index}
                className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-border/50">
          {children}
        </tbody>
      </table>
    </div>
  );
}

interface TableRowProps {
  children: ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}

function TableRow({ children, onClick, highlight = false }: TableRowProps) {
  return (
    <tr 
      className={`
        transition-colors duration-150
        ${highlight ? 'bg-red-500/5' : 'hover:bg-white/[0.02]'}
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

interface TableCellProps {
  children: ReactNode;
  className?: string;
}

function TableCell({ children, className = '' }: TableCellProps) {
  return (
    <td className={`px-5 py-4 text-sm text-white/70 ${className}`}>
      {children}
    </td>
  );
}

export { Table, TableRow, TableCell };
