import React from 'react';

type TodoType = {
    id: number;
    name: string;
    urgent: boolean;
    important: boolean;
};

type TodoTableProps = {
    todos: TodoType[];
};

const TodoTable = ({ todos }: TodoTableProps) => {
    return (
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Urgent</th>
                    <th>Important</th>
                </tr>
            </thead>
            <tbody>
                {todos.map(todo => (
                    <tr key={todo.id}>
                        <td>{todo.id}</td>
                        <td>{todo.name}</td>
                        <td>{todo.urgent ? "✔️" : "❌"}</td>
                        <td>{todo.important ? "✔️" : "❌"}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default TodoTable;
