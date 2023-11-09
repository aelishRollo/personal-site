import React from 'react';

const TableControls: React.FC = () => {
  // Define the CRUD function
  const crudTodos = () => {
    // Placeholder for actual CRUD operation
    console.log('CRUD operation executed');
  };

  // Define the Filter function
  const editTodos = () => {
    // Placeholder for actual edit / delete operation
    console.log('Edit / delete operation executed');
  };

  // Define the Filter function
  const filterTodos = () => {
    // Placeholder for actual filter operation
    console.log('Filter operation executed');
  };

  return (
    <div className="button-container">
      <button onClick={crudTodos}>Create</button>
      <button onClick={editTodos}>Edit / Delete</button>
      <button onClick={filterTodos}>Filter</button>
    </div>
  );
};

export default TableControls;
