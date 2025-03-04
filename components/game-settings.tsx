"use client"

import { useState, useEffect } from "react"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Save } from "lucide-react"

// Define the form schema
const gameSettingsSchema = z.object({
  gameType: z.enum(["cash", "tournament"], {
    required_error: "Please select a game type.",
  }),
  tableSize: z.enum(["2", "6", "8", "9", "10"], {
    required_error: "Please select a table size.",
  }).optional(),
  smallBlind: z.string().optional(),
  bigBlind: z.string().optional(),
  ante: z.string().optional(),
  buyIn: z.string().optional(),
  startingStack: z.string().optional(),
  currency: z.enum(["$", "€", "£"], {
    required_error: "Please select a currency.",
  }).default("$"),
})

type GameSettingsValues = z.infer<typeof gameSettingsSchema>

// Default values
const defaultValues: Partial<GameSettingsValues> = {
  gameType: "cash",
  tableSize: "9",
  smallBlind: "1",
  bigBlind: "2",
  ante: "0",
  currency: "$",
  startingStack: "100",
}

interface GameSettingsProps {
  onSettingsSaved: (settings: GameSettingsValues) => void
}

export function GameSettings({ onSettingsSaved }: GameSettingsProps) {
  // Initialize the form with react-hook-form
  const form = useForm<GameSettingsValues>({
    resolver: zodResolver(gameSettingsSchema),
    defaultValues,
  })

  // Load saved settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("poker-game-settings")
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings)
      Object.keys(parsedSettings).forEach((key) => {
        form.setValue(key as any, parsedSettings[key])
      })
    }
  }, [form])

  // Handle form submission
  function onSubmit(data: GameSettingsValues) {
    // Save to localStorage
    localStorage.setItem("poker-game-settings", JSON.stringify(data))
    
    // Notify parent component
    onSettingsSaved(data)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Game Settings</CardTitle>
        <CardDescription>
          Configure table information to streamline your hand recordings.
          All fields are optional but will help create more detailed hand histories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="gameType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Game Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="cash" />
                        </FormControl>
                        <FormLabel className="font-normal">Cash Game</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="tournament" />
                        </FormControl>
                        <FormLabel className="font-normal">Tournament</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tableSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Table Size</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select table size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-gray-800 border border-gray-700">
                        <SelectItem value="2">Heads Up (2-max)</SelectItem>
                        <SelectItem value="6">6-max</SelectItem>
                        <SelectItem value="8">8-max</SelectItem>
                        <SelectItem value="9">9-max</SelectItem>
                        <SelectItem value="10">10-max</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Maximum number of players at the table
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-gray-800 border border-gray-700">
                        <SelectItem value="$">USD ($)</SelectItem>
                        <SelectItem value="€">EUR (€)</SelectItem>
                        <SelectItem value="£">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {form.watch("gameType") === "cash" ? (
                <>
                  <FormField
                    control={form.control}
                    name="smallBlind"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Small Blind</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="1" {...field} className="bg-gray-800 border-gray-700" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bigBlind"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Big Blind</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="2" {...field} className="bg-gray-800 border-gray-700" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ante"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ante (optional)</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="0" {...field} className="bg-gray-800 border-gray-700" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="startingStack"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Stack Size</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="100" {...field} className="bg-gray-800 border-gray-700" />
                        </FormControl>
                        <FormDescription>
                          In big blinds (e.g., 100BB)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="buyIn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tournament Buy-in</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="10" {...field} className="bg-gray-800 border-gray-700" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startingStack"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Starting Chips</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="1500" {...field} className="bg-gray-800 border-gray-700" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            <Button type="submit" className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
} 