import { serve, file, SQL } from "bun";
import ejs from "ejs";

const PORT = 3000;
const API_URL = "https://openlibrary.org";

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
	publish_date: string,
	read_date: string,
	rating: number,
	notes: string,
};

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
			GET: async () => Response.json({ message: "book-notes" }, { status: 404 }),
		},

		"/book/$1": {
			GET: async () => Response.redirect("/"),
		},

		"/add-book": {
			GET: async () => Response.redirect("/"),

			POST: async () => Response.redirect("/"),
		},

		"/edit-book": {
			GET: async () => Response.redirect("/"),

			POST: async () => Response.redirect("/"),
		},

		"/delete-book": {
			GET: async () => Response.redirect("/"),

			POST: async () => Response.redirect("/"),
		},
	},

	fetch(req) {
		return Response.json({ message: `Route ${req.method} ${req.url} not found` }, { status: 404 });
	},
});

console.log(`Server is running at http://localhost:${PORT}.\n`);
