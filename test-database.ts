// test-database.ts
// Simple script to test database connection and basic queries

import { regeneraDB } from "./sql-executor.ts";

async function testDatabase() {
  console.log("🧪 Testing Regenera PostgreSQL Database Connection\n");

  try {
    // Test 1: Connection Test
    console.log("1️⃣ Testing database connection...");
    const isConnected = await regeneraDB.testConnection();

    if (!isConnected) {
      console.log("❌ Database connection failed");
      console.log("Please check:");
      console.log("- Network connectivity");
      console.log("- Database credentials");
      console.log("- Database server status");
      return;
    }

    console.log("✅ Database connection successful!\n");

    // Test 2: Schema Information
    console.log("2️⃣ Fetching database schema...");
    const schemaResult = await regeneraDB.getTableInfo();

    if (schemaResult.success && schemaResult.data) {
      const tables = [
        ...new Set(schemaResult.data.map((row: any) => row.table_name)),
      ];
      console.log(`✅ Found ${tables.length} tables:`);
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table}`);
      });
      console.log();
    } else {
      console.log("❌ Failed to fetch schema information");
      console.log(`Error: ${schemaResult.error}\n`);
    }

    // Test 3: Sample Queries
    console.log("3️⃣ Testing sample queries...");

    const testQueries = [
      {
        name: "List Tables",
        query:
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
      },
      {
        name: "Count Organizations",
        query: "SELECT COUNT(*) as total_organizations FROM organization",
      },
      {
        name: "Sample Organizations",
        query:
          "SELECT organizationName, sector, country FROM organization LIMIT 3",
      },
      {
        name: "List Landscapes",
        query:
          "SELECT name, region FROM landscape WHERE isActive = true LIMIT 5",
      },
    ];

    for (const test of testQueries) {
      console.log(`\n📋 ${test.name}:`);
      console.log(`Query: ${test.query}`);

      const result = await regeneraDB.executeQuery(test.query);

      if (result.success) {
        console.log(`✅ Success - ${result.rowCount} row(s) returned`);
        if (result.data && result.data.length > 0) {
          console.log("Sample data:");
          result.data.slice(0, 3).forEach((row, index) => {
            console.log(`  ${index + 1}. ${JSON.stringify(row)}`);
          });
        }
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    }

    // Test 4: SQL Agent Format Test
    console.log("\n4️⃣ Testing SQL Agent format simulation...");

    const agentQuery =
      "SELECT organizationName, sector FROM organization WHERE country = 'Peru'";
    console.log(`Query: ${agentQuery}`);

    const agentResult = await regeneraDB.executeQuery(agentQuery);

    if (agentResult.success) {
      const formattedResult = {
        query_executed: agentResult.executedQuery,
        row_count: agentResult.rowCount || 0,
        data: agentResult.data || [],
        message: agentResult.rowCount === 0
          ? "Query executed successfully but returned no results."
          : `Query executed successfully. Retrieved ${agentResult.rowCount} row(s).`,
      };

      console.log("✅ SQL Agent simulation successful:");
      console.log(JSON.stringify(formattedResult, null, 2));
    } else {
      console.log(`❌ SQL Agent simulation failed: ${agentResult.error}`);
    }

    console.log("\n🎉 Database testing completed!");
  } catch (error) {
    console.error("❌ Unexpected error during database testing:", error);
  }
}

// Run the test if this script is executed directly
testDatabase();
