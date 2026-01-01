import  type { ReactNode } from 'react';

interface TableProps {
  headers: string[];
  children: ReactNode;
}

function Table({ headers, children }: TableProps) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-dark-bg">
          <tr>
            {headers.map((header, index) => (
              <th 
                key={index}
                className="px-6 py-4 text-left text-sm font-semibold text-primary-blue border-b-2 border-dark-border"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
}

// TableRow component
interface TableRowProps {
  children: ReactNode;
  onClick?: () => void;
}

function TableRow({ children, onClick }: TableRowProps) {
  return (
    <tr 
      className={`border-b border-dark-border hover:bg-dark-bg transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

// TableCell component
interface TableCellProps {
  children: ReactNode;
  className?: string;
}

function TableCell({ children, className = '' }: TableCellProps) {
  return (
    <td className={`px-6 py-4 text-sm text-gray-300 ${className}`}>
      {children}
    </td>
  );
}

// Export as object for grouped imports
export { Table, TableRow, TableCell };