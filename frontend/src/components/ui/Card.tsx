import type { ReactNode } from 'react';

interface CardProps{
    children:ReactNode;
    className?:string;

}
function Card(  {children,className=''} :CardProps)
{
return(
<div  className={`bg-dark-card border border-dark-border rounded-xl p-6 ${className}`}>
    {children}
</div>
);
}
export default Card;