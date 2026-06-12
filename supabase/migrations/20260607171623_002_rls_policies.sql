-- RLS Policies for profiles (publicly readable)
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS Policies for banks
CREATE POLICY "banks_select" ON banks FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT user_id FROM bank_participants WHERE bank_id = banks.id));
CREATE POLICY "banks_insert" ON banks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "banks_update" ON banks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM bank_participants WHERE bank_id = banks.id AND user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "banks_delete" ON banks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for bank_participants
CREATE POLICY "bank_participants_select" ON bank_participants FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM banks WHERE id = bank_id AND user_id = auth.uid()));
CREATE POLICY "bank_participants_insert" ON bank_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM banks WHERE id = bank_id AND user_id = auth.uid()));
CREATE POLICY "bank_participants_update" ON bank_participants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM banks WHERE id = bank_id AND user_id = auth.uid()));
CREATE POLICY "bank_participants_delete" ON bank_participants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM banks WHERE id = bank_id AND user_id = auth.uid()));

-- RLS Policies for owners
CREATE POLICY "owners_select" ON owners FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners_insert" ON owners FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners_update" ON owners FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners_delete" ON owners FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for clients
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_update" ON clients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clients_delete" ON clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for properties - allow viewing network-visible properties
CREATE POLICY "properties_select" ON properties FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR visibility = 'rede' OR (visibility = 'banco' AND bank_id IN (SELECT bank_id FROM bank_participants WHERE user_id = auth.uid())));
CREATE POLICY "properties_insert" ON properties FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "properties_update" ON properties FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "properties_delete" ON properties FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for exchanges - allow viewing network-visible exchanges
CREATE POLICY "exchanges_select" ON exchanges FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR visibility = 'rede' OR (visibility = 'banco' AND bank_id IN (SELECT bank_id FROM bank_participants WHERE user_id = auth.uid())));
CREATE POLICY "exchanges_insert" ON exchanges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exchanges_update" ON exchanges FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "exchanges_delete" ON exchanges FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for matches
CREATE POLICY "matches_select" ON matches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "matches_insert" ON matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "matches_update" ON matches FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "matches_delete" ON matches FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for conversations
CREATE POLICY "conversations_select" ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = ANY(participants));
CREATE POLICY "conversations_insert" ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ANY(participants));
CREATE POLICY "conversations_update" ON conversations FOR UPDATE TO authenticated
  USING (auth.uid() = ANY(participants));
CREATE POLICY "conversations_delete" ON conversations FOR DELETE TO authenticated
  USING (auth.uid() = ANY(participants) AND array_length(participants, 1) = 1);

-- RLS Policies for chat_messages
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND auth.uid() = ANY(participants)));
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND auth.uid() = ANY(participants)));

-- RLS Policies for ai_actions
CREATE POLICY "ai_actions_select" ON ai_actions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_actions_insert" ON ai_actions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS Policies for network_listings - visible to all authenticated users for public items
CREATE POLICY "network_listings_select" ON network_listings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM properties WHERE id = reference_id AND visibility = 'rede'));
CREATE POLICY "network_listings_insert" ON network_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "network_listings_delete" ON network_listings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_visibility ON properties(visibility);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_owners_user_id ON owners(user_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_user_id ON exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_banks_user_id ON banks(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participants);