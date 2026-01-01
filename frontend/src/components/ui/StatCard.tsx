interface StatCardProps{
    icon:string;
    value:number|string;
    label:string;
    trend?:{

        value:number;
        isPositive:boolean;
    },
}
function StatCard({icon,value,label,trend}:StatCardProps){
return(




     <div className="bg-dark-card border border-dark-border rounded-xl p-6 flex items-center gap-4 hover:border-primary-blue transition-colors">
      <div className="text-5xl">{icon}</div>
      
      <div className="flex-1">
        <div className="text-4xl font-bold text-primary-blue">{value}</div>
             <div className="text-sm text-gray-400 mt-1">{label}</div>
        
        {trend && (
          <div className={`text-xs mt-2 flex items-center gap-1 ${trend.isPositive ? 'text-accent-green' : 'text-red-400'}`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
