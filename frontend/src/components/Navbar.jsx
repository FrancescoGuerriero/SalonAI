import { Link } from "react-router-dom";


function Navbar(){

return (

<nav className="
flex
justify-between
items-center
p-4
bg-white
shadow
">

<h1 className="
text-xl
font-bold
text-pink-600
">
SalonAI
</h1>


<div className="
space-x-4
">

<Link to="/">
Home
</Link>


<Link to="/services">
Services
</Link>


<Link to="/login">
Login
</Link>

<Link to="/register">
Register
</Link>

<Link to="/booking">
Book
</Link>

</div>


</nav>

);

}


export default Navbar;