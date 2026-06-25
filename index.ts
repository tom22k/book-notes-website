import { serve, file, SQL } from "bun";
import ejs from "ejs";
import type { NumericLiteral } from "typescript";

const PORT = 3000;
const API_URL = "https://openlibrary.org";
const headers = new Headers({
	"User-Agent": process.env.API_USER_AGENT,
});

const sql = new SQL({
	adapter: "postgres",
	hostname: process.env.SQL_HOSTNAME,
	port: process.env.SQL_PORT,
	database: "book_notes",
	username: process.env.SQL_USERNAME,
	password: process.env.SQL_PASSWORD,
});
await sql.connect();

interface book {
	id: number,
	isbn: string,
	title: string,
	author: string,
	publish_year: number,
	read_date: string,
	rating: number,
	notes: string,
};

function cleanInput(input: string | null): string {
	return input?.toString().trim() || "";
}

serve({
	port: PORT,
	routes: {
		"/public/*": {
			GET: (req) => {
				try {
					const url = new URL(req.url);
					return new Response(file(`.${url.pathname}`));
				} catch (error) {
					return new Response("File not found", { status: 404 });
				}
			},
		},

		"/": {
			GET: async () => Response.redirect("/books"),
		},

		"/books": {
			GET: async () => {
				const books: book[] = await sql`
					SELECT *
					FROM books
					ORDER BY title ASC;
				`;

				const html = await ejs.renderFile("./views/list.ejs", { books: books });
				return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
			},
		},

		"/books/add": {
			GET: async () => {
				const html = await ejs.renderFile("./views/add.ejs");
				return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
			},

			POST: async (req) => {
				const bodyText = await req.text();
				const formData = new URLSearchParams(bodyText);
				const isbn = cleanInput(formData.get("isbn"));
				const readDate = cleanInput(formData.get("readDate"));
				const rating = cleanInput(formData.get("rating"));
				const notes = cleanInput(formData.get("notes"));
				if (!isbn) {
					return Response.json({ "message": "Please enter a valid ISBN number." }, { status: 400 });
				}

				let result;
				let json;
				try {
					result = await fetch(`${API_URL}/search.json?isbn=${isbn}`, { method: "GET", headers: headers });
					json = await result.json();
				} catch (err) {
					console.error("Unknown error", err);

					return Response.json({ "message": "Unknown error." }, { status: 500 });
				}

				if (json.num_found === 0) {
					return Response.json({ "message": `No book with ISBN ${isbn} exists.` }, { status: 404 });
				}

				const book = json.docs[0];

				let added: book[];
				try {
					added = await sql`
							INSERT INTO books (isbn, title, author, publish_year, read_date, rating, notes)
							VALUES (${isbn}, ${book.title}, ${book.author_name.join(", ")}, ${book.first_publish_year}, ${readDate || null}, ${rating || null}, ${notes || null})
							RETURNING *;
						`;

				} catch (err) {
					console.error("Error executing query", err);

					return Response.json({ "message": "Unknown error." }, { status: 500 });
				}

				if (!added || !added[0]) {
					return Response.json({ "message": "Unknown error." }, { status: 500 });
				}

				return Response.redirect(`/books/${added[0].id}`);
			},
		},

		"/books/:id": {
			GET: async (req) => {
				const id = parseInt(req.params.id);
				if (!id) {
					return Response.json({ error: `Invalid book ID: ${id}.` }, { status: 400 });
				}

				let found: book[];
				try {
					found = await sql`
						SELECT * FROM books
						WHERE id = ${id};
					`;
				} catch (err) {
					console.error("Error executing query", err);

					return Response.json({ "message": "Unknown error." }, { status: 500 });
				}

				if (!found) {
					return Response.json({ "message": `No book with ID ${id} exists.` }, { status: 404 });
				}

				const html = await ejs.renderFile("./views/details.ejs", { book: found[0] });
				return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
			},
		},

		"/books/:id/edit": {
			GET: async (req) => {
				const id = parseInt(req.params.id);
				if (!id) {
					return Response.json({ error: `Invalid book ID: ${id}.` }, { status: 400 });
				}

				let found: book[];
				try {
					found = await sql`
						SELECT * FROM books
						WHERE id = ${id};
					`;
				} catch (err) {
					console.error("Error executing query", err);

					return Response.json({ "message": "Unknown error." }, { status: 500 });
				}

				if (!found) {
					return Response.json({ "message": `No book with ID ${id} exists.` }, { status: 404 });
				}

				const html = await ejs.renderFile("./views/edit.ejs", { book: found[0] });
				return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
			},

			POST: async (req) => {
				const id = parseInt(req.params.id);
				if (!id) {
					return Response.json({ error: `Invalid book ID: ${id}.` }, { status: 400 });
				}

				const bodyText = await req.text();
				const formData = new URLSearchParams(bodyText);
				const isbn = cleanInput(formData.get("isbn"));
				const title = cleanInput(formData.get("title"));
				const author = cleanInput(formData.get("author"));
				const readDate = cleanInput(formData.get("readDate"));
				const rating = cleanInput(formData.get("rating"));
				const notes = cleanInput(formData.get("notes"));
				if (!isbn || !title || !author) {
					return Response.json({ "message": "Please enter a valid ISBN number, title, and author." }, { status: 400 });
				}

				let edited: book[];
				try {
					edited = await sql`
						UPDATE books
							SET
								isbn = ${isbn},
								title = ${title},
								author = ${author},
								read_date = ${readDate},
								rating = ${rating},
								notes = ${notes}
						WHERE id = ${id}
						RETURNING *;
					`;
				} catch (err) {
					console.error("Error executing query", err);

					return Response.json({ "message": "Unknown error." }, { status: 500 });
				}

				if (!edited) {
					return Response.json({ "message": `No book with ID ${id} exists.` }, { status: 404 });
				}

				return Response.redirect(`/books/${id}`);
			},
		},

		"/books/:id/delete": {
			GET: async () => Response.redirect("/"),

			POST: async (req) => {
				const id = parseInt(req.params.id);
				if (!id) {
					return Response.json({ error: `Invalid book ID: ${id}.` }, { status: 400 });
				}

				try {
					const deleted: book[] = await sql`
						DELETE FROM books
						WHERE id = ${id}
						RETURNING *;
					`;

					if (deleted.length === 0) {
						return Response.json({ "message": `The book with ID ${id} doesn't exist.` }, { status: 404 })
					}
				} catch (err) {
					console.error("Error executing query", err);

					return Response.json({ "message": "Unknown error." }, { status: 500 });
				}

				return Response.redirect("/");
			},
		},
	},

	fetch(req) {
		return Response.json({ message: `Route ${req.method} ${req.url} not found` }, { status: 404 });
	},
});

console.log(`Server is running at http://localhost:${PORT}.\n`);
